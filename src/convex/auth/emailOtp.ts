import { Email } from "@convex-dev/auth/providers/Email";
import { RandomReader, generateRandomString } from "@oslojs/crypto/random";
import { internal } from "../_generated/api";
import { OTP_SEND_LIMITS } from "../rateLimit";
import { vly } from "../../lib/vly-integrations";

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
 * Envoi des codes OTP par email via le service email NATIF de la plateforme
 * (`vly.email.send`, cf. integrations.md). La clé `VLY_INTEGRATION_KEY` est
 * injectée automatiquement par la plateforme à la création du projet — AUCUNE
 * clé à obtenir, à stocker ni à faire tourner. Le même canal sert déjà aux
 * emails de consentement parental (src/convex/parentalConsent.ts).
 *
 * Sans clé (environnement mal configuré), l'envoi échoue proprement avec un
 * message générique et la cause réelle est journalisée côté serveur (jamais
 * de token ni de secret dans le log ni dans l'erreur exposée au client).
 */

type SendCtx = {
  runMutation?: (
    fn: unknown,
    args: unknown,
  ) => Promise<{ allowed: boolean; retryAfterMs?: number } | undefined>;
};

/** Échappe un texte pour un template HTML inline (anti-injection). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

    // Garde-fou : clé d'intégration absente → on échoue AVANT l'appel réseau
    // (createVlyIntegrations accepte un token par défaut qui échouerait
    // silencieusement côté passerelle). La cause réelle est journalisée côté
    // serveur, jamais dans le message exposé au client.
    if (!process.env.VLY_INTEGRATION_KEY?.trim()) {
      console.error(
        "[emailOtp] VLY_INTEGRATION_KEY manquante — vérifier la configuration de la plateforme (elle est normalement injectée automatiquement).",
      );
      throw new Error("Le service d'envoi de codes n'est pas configuré.");
    }

    const subject = "🔐 Ton code StudySnap";
    const text = [
      "Salut !",
      "",
      `Ton code de connexion StudySnap est : ${token}`,
      "",
      "Il est valable 15 minutes. Si tu n'es pas à l'origine de cette demande,",
      "tu peux ignorer cet email — personne ne pourra l'utiliser sans ton code.",
      "",
      "— L'équipe StudySnap",
    ].join("\n");
    const html = `
      <div style="background:#f4f4fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
        <div style="max-width:440px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e8e8f2">
          <div style="background:linear-gradient(135deg,#4f46e5,#ff6b4a);padding:20px 24px">
            <p style="margin:0;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.2px">
              Study<span style="opacity:0.9">Snap</span>
            </p>
          </div>
          <div style="padding:28px 24px">
            <p style="margin:0 0 8px;font-size:16px;font-weight:700;color:#1a1a2e">
              Ton code de connexion
            </p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#5a5a75">
              Voici ton code à 6 chiffres pour te connecter avec
              <strong>${escapeHtml(email)}</strong> :
            </p>
            <div style="background:#f6f6fc;border:2px dashed #c7c7e4;border-radius:14px;padding:18px;text-align:center">
              <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#4f46e5;font-family:monospace">${escapeHtml(token)}</span>
            </div>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#8a8aa3">
              Ce code expire dans <strong>15 minutes</strong>. Si tu n'es pas à
              l'origine de cette demande, ignore simplement cet email.
            </p>
          </div>
        </div>
      </div>
    `;

    const res = await vly.email.send({ to: email, subject, text, html });
    if (!res.success) {
      // Cause réelle journalisée côté serveur (dashboard Convex) — jamais de
      // token dans le log ni dans le message d'erreur exposé au client.
      console.error(
        "[emailOtp] Envoi du code refusé par le service email :",
        res.error,
      );
      throw new Error("Échec de l'envoi du code — réessaie dans un instant.");
    }
  },
});
