"use node";

/**
 * StudySnap — consentement parental (mineurs de moins de 15 ans).
 *
 * Un utilisateur déclarant avoir moins de 15 ans doit renseigner l'email d'un
 * parent / tuteur légal. Son compte est créé avec le statut "pending" et un
 * accès limité (les mutations de génération — scan, fiche, quiz — sont
 * bloquées tant que le parent n'a pas confirmé).
 *
 * Le parent reçoit un email avec un lien de confirmation à usage unique
 * (token aléatoire 256 bits, stocké uniquement en hash SHA-256, expiration
 * 72 h). Un rappel automatique est envoyé après 48 h sans confirmation, et le
 * statut passe à "expired" quand le token expire. L'utilisateur peut renvoyer
 * l'email ou renseigner un autre email parent depuis l'application.
 *
 * L'envoi d'email passe par l'intégration Vly (VLY_INTEGRATION_KEY) ;
 * sans clé, l'action renvoie { emailSent: false } et l'utilisateur peut
 * réessayer plus tard (le compte reste en attente).
 */
import { createHash, randomBytes } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { vly } from "../lib/vly-integrations";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { ParentalUserView } from "./parentalConsentInternal";

export const CONSENT_TTL_MS = 72 * 60 * 60 * 1000; // 72 h
export const RESEND_COOLDOWN_MS = 5 * 60 * 1000; // 5 min entre deux envois

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function siteBaseUrl(fallback?: string): string {
  return (
    process.env.SITE_URL ??
    process.env.CONVEX_SITE_URL ??
    fallback ??
    "https://studysnap.app"
  );
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): { token: string; hash: string; expiresAt: number } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: Date.now() + CONSENT_TTL_MS };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendParentalEmail(opts: {
  to: string;
  childEmail: string;
  confirmUrl: string;
  isReminder?: boolean;
}): Promise<{ sent: boolean; error?: string }> {
  const { to, childEmail, confirmUrl, isReminder } = opts;
  const subject = isReminder
    ? `Rappel — validation parentale StudySnap pour ${childEmail}`
    : `StudySnap — autorisation parentale pour ${childEmail}`;
  const text = [
    `Bonjour,`,
    ``,
    `${childEmail} souhaite utiliser StudySnap, une application d'aide aux devoirs par intelligence artificielle (photo d'exercice → explication, fiche de révision, quiz).`,
    ``,
    `Pour des raisons de protection des mineurs, l'accès complet à l'application n'est activé qu'avec votre accord.`,
    ``,
    `👉 Confirmez : ${confirmUrl}`,
    ``,
    `Ce lien est à usage unique et expire sous 72 heures.`,
    ``,
    `Si vous n'êtes pas le parent ou tuteur légal de ${childEmail}, ou si cette demande ne vous semble pas légitime, ne cliquez pas sur le lien et écrivez-nous à support@studysnap.app.`,
    ``,
    `L'équipe StudySnap`,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1c1c22">
      <h2 style="margin:0 0 12px">👋 Validation parentale StudySnap</h2>
      <p style="line-height:1.6;color:#333">
        <strong>${escapeHtml(childEmail)}</strong> souhaite utiliser StudySnap, une application
        d'aide aux devoirs par intelligence artificielle (photo d'exercice → explication,
        fiche de révision, quiz).
      </p>
      <p style="line-height:1.6;color:#333">
        Pour des raisons de protection des mineurs, l'accès complet à l'application n'est activé
        qu'avec votre accord.
      </p>
      <p style="margin:24px 0;text-align:center">
        <a href="${escapeHtml(confirmUrl)}"
           style="display:inline-block;padding:14px 28px;border-radius:9999px;background:#4f4fe5;color:#fff;text-decoration:none;font-weight:bold">
          ✅ Confirmer l'accès de mon enfant
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6">
        Ce lien est à usage unique et expire sous 72 heures. Si vous n'êtes pas le parent ou
        tuteur légal de ${escapeHtml(childEmail)} ou si cette demande ne vous semble pas légitime,
        ne cliquez pas sur le lien et écrivez-nous à support@studysnap.app.
      </p>
    </div>
  `;
  try {
    const res = await vly.email.send({ to, subject, text, html });
    if (!res.success) return { sent: false, error: res.error ?? "Échec d'envoi" };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}

/* ------------------------------------------------------------------ */
/* Enregistrement de la demande parentale (première fois ou changement) */
/* ------------------------------------------------------------------ */

export const submitParentalRequest = action({
  args: {
    parentEmail: v.string(),
    siteUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });

    const email = args.parentEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      throw new ConvexError({
        code: "INVALID_PARENT_EMAIL",
        message: "L'adresse email du parent n'est pas valide.",
      });
    }

    const user = (await ctx.runQuery(
      internal.parentalConsentInternal.getParentalUser,
      { userId },
    )) as ParentalUserView | null;
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });

    const { token, hash, expiresAt } = generateToken();
    const now = Date.now();

    await ctx.runMutation(internal.parentalConsentInternal.patchParentalUser, {
      userId,
      isMinor: true,
      parentEmail: email,
      parentalConsentStatus: "pending",
      parentalConsentTokenHash: hash,
      parentalConsentTokenExpiresAt: expiresAt,
      parentalConsentLastSentAt: now,
    });

    const confirmUrl = `${siteBaseUrl(args.siteUrl)}/parental-consent?token=${encodeURIComponent(token)}`;
    const emailResult = await sendParentalEmail({
      to: email,
      childEmail: user.email,
      confirmUrl,
    });

    return { ok: true, emailSent: emailResult.sent, status: "pending" };
  },
});

/* ------------------------------------------------------------------ */
/* Renvoi de l'email (cooldown 5 min, nouveau token à chaque envoi)     */
/* ------------------------------------------------------------------ */

export const resendParentalEmail = action({
  args: { siteUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    const user = (await ctx.runQuery(
      internal.parentalConsentInternal.getParentalUser,
      { userId },
    )) as ParentalUserView | null;
    if (!user) throw new ConvexError({ code: "UNAUTHENTICATED" });

    if (user.parentalConsentStatus === "confirmed") {
      return { ok: false, reason: "already_confirmed" };
    }
    if (!user.isMinor) {
      throw new ConvexError({ code: "NOT_MINOR" });
    }

    const lastSent = user.parentalConsentLastSentAt;
    if (Date.now() - lastSent < RESEND_COOLDOWN_MS) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message:
          "Un email a déjà été envoyé il y a moins de 5 minutes. Réessaie dans quelques instants.",
      });
    }

    const { token, hash, expiresAt } = generateToken();
    const now = Date.now();
    await ctx.runMutation(internal.parentalConsentInternal.patchParentalUser, {
      userId,
      parentalConsentStatus: "pending",
      parentalConsentTokenHash: hash,
      parentalConsentTokenExpiresAt: expiresAt,
      parentalConsentLastSentAt: now,
    });

    const confirmUrl = `${siteBaseUrl(args.siteUrl)}/parental-consent?token=${encodeURIComponent(token)}`;
    const emailResult = await sendParentalEmail({
      to: user.parentEmail,
      childEmail: user.email,
      confirmUrl,
    });

    return { ok: true, emailSent: emailResult.sent, status: "pending" };
  },
});

/* ------------------------------------------------------------------ */
/* Confirmation / refus par le parent (page publique)                  */
/* ------------------------------------------------------------------ */

export const confirmParentalConsent = action({
  args: {
    token: v.string(),
    decision: v.optional(v.union(v.literal("approve"), v.literal("refuse"))),
  },
  handler: async (ctx, args) => {
    const hash = hashToken(args.token);
    const user = (await ctx.runQuery(
      internal.parentalConsentInternal.getUserByTokenHash,
      { tokenHash: hash },
    )) as ParentalUserView | null;

    if (!user) return { status: "invalid" as const };
    if (user.parentalConsentStatus === "confirmed") {
      return { status: "already_used" as const };
    }
    if (!user.parentalConsentTokenExpiresAt || Date.now() > user.parentalConsentTokenExpiresAt) {
      return { status: "expired" as const };
    }

    const refuse = args.decision === "refuse";
    const status: "confirmed" | "refused" = refuse ? "refused" : "confirmed";
    await ctx.runMutation(internal.parentalConsentInternal.patchParentalUser, {
      userId: user._id as never,
      parentalConsentStatus: status,
      parentalConsentConfirmedAt: refuse ? undefined : Date.now(),
      // Invalidation du token (le champ est réinitialisé, jamais réutilisable).
      parentalConsentTokenHash: "",
      parentalConsentTokenExpiresAt: 0,
    });

    return { status };
  },
});

/* ------------------------------------------------------------------ */
/* Rappel automatique (appelé par le cron via scheduler.runAfter)       */
/* ------------------------------------------------------------------ */

export const sendReminderForUser = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = (await ctx.runQuery(
      internal.parentalConsentInternal.getParentalUser,
      { userId: args.userId },
    )) as ParentalUserView | null;
    if (!user || user.parentalConsentStatus !== "pending") return { sent: false };

    const { token, hash, expiresAt } = generateToken();
    const now = Date.now();
    await ctx.runMutation(internal.parentalConsentInternal.patchParentalUser, {
      userId: args.userId,
      parentalConsentTokenHash: hash,
      parentalConsentTokenExpiresAt: expiresAt,
      parentalConsentLastSentAt: now,
      parentalConsentReminderSentAt: now,
    });

    const confirmUrl = `${siteBaseUrl()}/parental-consent?token=${encodeURIComponent(token)}`;
    const emailResult = await sendParentalEmail({
      to: user.parentEmail,
      childEmail: user.email,
      confirmUrl,
      isReminder: true,
    });
    return { sent: emailResult.sent };
  },
});
