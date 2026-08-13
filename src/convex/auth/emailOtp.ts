import { Email } from "@convex-dev/auth/providers/Email";
import axios from "axios";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { internal } from "../_generated/api";
import { OTP_SEND_LIMITS } from "../rateLimit";

/**
 * BUG BLOQUANT CORRIGÉ : la bibliothèque @convex-dev/auth exige la variable
 * `SITE_URL` pour TOUT envoi de code email (construction du lien magique,
 * `redirectAbsoluteUrl` → `requireEnv("SITE_URL")`) — et ce AVANT même que
 * notre `sendVerificationRequest` ne soit appelé. Si `SITE_URL` manque dans
 * l'environnement backend, chaque demande de code échoue avec
 * « Missing environment variable SITE_URL », que l'interface affiche comme
 * erreur générique. La plateforme fournit `CONVEX_SITE_URL` : on bascule
 * dessus en repli (la valeur ne sert qu'au lien du message, ignoré par notre
 * envoi personnalisé).
 */
if (!process.env.SITE_URL && process.env.CONVEX_SITE_URL) {
  process.env.SITE_URL = process.env.CONVEX_SITE_URL;
}

/**
 * Clés d'envoi d'OTP par email — FOURNIES PAR L'ENVIRONNEMENT (UI Keys de la
 * plateforme), jamais codées en dur dans le code source. Sans clé, l'envoi
 * échoue proprement (message générique, aucun secret dans l'erreur).
 *
 * ROTATION SANS INTERRUPTION : la clé primaire FREEBUFF_EMAIL_API_KEY est
 * essayée d'abord ; si le fournisseur la refuse (HTTP 401/403), la clé
 * précédente FREEBUFF_EMAIL_API_KEY_PREVIOUS prend le relais pendant la
 * période de chevauchement. Une fois la nouvelle clé validée, retirer
 * *_PREVIOUS de l'environnement (voir SECURITY.md — Runbook de rotation).
 *
 * Lues à chaque envoi (pas capturées à l'import du module) pour rester
 * cohérentes avec l'environnement courant (tests, rechargement de clé).
 */

type SendCtx = {
  runMutation?: (
    fn: unknown,
    args: unknown,
  ) => Promise<{ allowed: boolean; retryAfterMs?: number } | undefined>;
};

export const emailOtp = Email({
  id: "email-otp",
  maxAge: 60 * 15, // 15 minutes
  // This function can be asynchronous
  async generateVerificationToken() {
    const random: RandomReader = {
      read(bytes: Uint8Array) {
        crypto.getRandomValues(bytes);
      },
    };
    const alphabet = "0123456789";
    return generateRandomString(random, alphabet, 6);
  },
  async sendVerificationRequest(
    { identifier: email, token },
    maybeCtx?: SendCtx,
  ) {
    // Rate limiting distribué (table rate_limits) : au plus 3 envois par
    // email sur 15 min — anti-flood d'emails (connexion + inscription par
    // code). Le contexte d'action est transmis par la bibliothèque en second
    // argument (signature non typée côté provider) ; s'il est absent (tests
    // directs), la limite est sautée.
    const ctx = maybeCtx as SendCtx | undefined;
    if (ctx?.runMutation) {
      const rl = await ctx.runMutation(internal.rateLimit.consume, {
        key: `otp:${email}`,
        windowMs: OTP_SEND_LIMITS.windowMs,
        max: OTP_SEND_LIMITS.max,
      });
      if (rl && !rl.allowed) {
        // Message volontairement générique : pas de détail de fenêtre, pas
        // d'email — le client n'a pas besoin de savoir pour qui la limite
        // s'est déclenchée.
        throw new Error(
          "Trop de demandes de code par email. Réessaie dans quelques minutes.",
        );
      }
    }

    // Unicité de l'adresse (un email = un compte) — vérification en base AVANT
    // l'envoi du code : si un utilisateur existe avec cet email mais aucun
    // compte email-otp, l'adresse est déjà prise (compte mot de passe…) →
    // inscription refusée, aucun code envoyé. Un compte email-otp existant
    // reste une connexion normale.
    if (ctx?.runMutation) {
      await ctx.runMutation(internal.authUniqueness.assertEmailConflictFree, {
        email,
      });
    }

    const apiKeys = [
      process.env.FREEBUFF_EMAIL_API_KEY,
      process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS,
    ].filter((k): k is string => Boolean(k?.trim()));
    if (apiKeys.length === 0) {
      // Cause réelle journalisée côté serveur (dashboard Convex) — jamais de
      // clé ni de token dans le log ni dans le message d'erreur.
      console.error(
        "[emailOtp] Aucune clé d'envoi configurée (FREEBUFF_EMAIL_API_KEY) — vérifier l'onglet Keys.",
      );
      throw new Error("Le service d'envoi de codes n'est pas configuré.");
    }

    for (const apiKey of apiKeys) {
      try {
        const res = await axios.post(
          "https://auth.freebuff.app/send_otp",
          {
            to: email,
            otp: token,
            appName: process.env.VLY_APP_NAME || "a freebuff.com application",
          },
          {
            headers: {
              "x-api-key": apiKey,
            },
          },
        );
        if (res.status >= 200 && res.status < 300) return;
        // Clé refusée (401/403) → clé suivante (rotation en chevauchement).
        // Autre statut (4xx métier, 5xx) → inutile d'essayer une autre clé.
        if (res.status !== 401 && res.status !== 403) {
          console.error(
            `[emailOtp] Envoi du code refusé par le service (HTTP ${res.status}).`,
          );
          break;
        }
        console.error(
          `[emailOtp] Clé API refusée (HTTP ${res.status}) — tentative avec la clé de secours.`,
        );
      } catch (e) {
        const status =
          (e as { response?: { status?: number } })?.response?.status ?? 0;
        // Réessayer avec la clé suivante UNIQUEMENT si la clé a été refusée
        // (401/403). Message générique : ne pas sérialiser l'erreur axios
        // (JSON.stringify d'une AxiosError expose la config de la requête —
        // clé API + OTP). La cause réelle est journalisée côté serveur.
        if (status !== 401 && status !== 403) {
          console.error(
            `[emailOtp] Échec de l'envoi du code (HTTP ${status || "réseau"}) — cause : ${(e as Error)?.message ?? "inconnue"}`,
          );
          throw new Error(
            "Échec de l'envoi du code — réessaie dans un instant.",
          );
        }
        console.error(
          `[emailOtp] Clé API refusée (HTTP ${status}) — tentative avec la clé de secours.`,
        );
      }
    }
    console.error(
      "[emailOtp] Toutes les clés d'envoi ont échoué — vérifier FREEBUFF_EMAIL_API_KEY dans l'onglet Keys.",
    );
    throw new Error("Échec de l'envoi du code — réessaie dans un instant.");
  },
});
