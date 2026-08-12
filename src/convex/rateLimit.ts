/**
 * StudySnap — rate limiting distribué (table `rate_limits`).
 *
 * Convex étant serverless (plusieurs instances, zéro état en mémoire partagé),
 * le compteur vit dans la base : c'est le « mécanisme distribué » demandé.
 * Chaque consommation est un read-check-write atomique dans une MÊME
 * mutation (les opérations DB d'une mutation sont atomiques entre elles),
 * donc deux requêtes simultanées ne peuvent pas doubler le compteur.
 *
 * Dimensions couvertes :
 *  - par email          : `otp:<email>`        → envois de codes (connexion +
 *                          inscription par code, anti-flood d'emails) ;
 *  - par compte         : `ai:<userId>`        → générations IA coûteuses
 *                          (OCR, analyse, fiche, quiz) ;
 *  - par compte/endpoint: quotas mensuels + espacement des scans (usage.ts).
 *
 * Limite par IP : NON applicable à cette couche — Convex 1.43 n'expose pas
 * l'adresse IP du client aux fonctions (pas de headers/IP sur query/mutation).
 * La protection IP doit être portée par la plateforme d'hébergement (WAF /
 * rate limiting Cloudflare sur le domaine de production, protections de la
 * plateforme sur l'aperçu). Documenté dans SECURITY.md.
 *
 * Erreurs : les handlers exposent un ConvexError code RATE_LIMITED + un
 * délai de réessai (retryAfterMs) — jamais de détail interne.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { recordDenial } from "./securityEvents";

/** Envois de code OTP par email : 3 maximum sur 15 minutes (fenêtre glissante). */
export const OTP_SEND_LIMITS = {
  windowMs: 15 * 60 * 1000,
  max: 3,
} as const;

/**
 * Générations IA par compte : 30 maximum sur 1 heure (fenêtre glissante).
 * Un parcours scan complet consomme 2 appels (OCR + analyse), un quiz 1, une
 * fiche 1 (2 avec OCR) — 30/h couvre ~10-15 parcours complets/heure, très
 * au-dessus du besoin d'un élève, et bloque le scriptage abusif des endpoints
 * coûteux du free tier.
 */
export const AI_GENERATION_LIMITS = {
  windowMs: 60 * 60 * 1000,
  max: 30,
} as const;

/** Rétention des seaux inactifs (purge hebdomadaire via cleanup.ts). */
export const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Type d'abus associé à une clé de seau — utilisé pour le journal
 * d'audit des tentatives bloquées (table security_events).
 */
export function kindOfKey(key: string): string {
  if (key.startsWith("otp:")) return "otp_flood";
  if (key.startsWith("ai:")) return "ai_generation";
  return "rate_limit";
}

export type ConsumeResult = {
  allowed: boolean;
  retryAfterMs: number;
};

/**
 * Consomme une unité du seau `key` (fenêtre glissante `windowMs`, plafond
 * `max`). Mutation INTERNE : jamais appellable depuis le client — seuls les
 * handlers serveur (actions IA, provider email OTP) l'invoquent.
 */
export const consume = internalMutation({
  args: {
    key: v.string(),
    windowMs: v.number(),
    max: v.number(),
  },
  handler: async (ctx, args): Promise<ConsumeResult> => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rate_limits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();

    if (!existing) {
      await ctx.db.insert("rate_limits", {
        key: args.key,
        windowStart: now,
        count: 1,
        updatedAt: now,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    // Fenêtre expirée → nouveau seau (le compteur ne s'accumule jamais au-delà).
    if (now - existing.windowStart >= args.windowMs) {
      await ctx.db.patch(existing._id, {
        windowStart: now,
        count: 1,
        updatedAt: now,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    if (existing.count < args.max) {
      await ctx.db.patch(existing._id, {
        count: existing.count + 1,
        updatedAt: now,
      });
      return { allowed: true, retryAfterMs: 0 };
    }

    // Refus : on journalise l'abus (une ligne par seau et par fenêtre).
    // C'est la trace visible dans le dashboard pour détecter un abus sans
    // exposer quoi que ce soit au client (l'erreur reste générique).
    await recordDenial(ctx, {
      bucket: args.key,
      kind: kindOfKey(args.key),
      windowStart: existing.windowStart,
    });
    return {
      allowed: false,
      retryAfterMs: existing.windowStart + args.windowMs - now,
    };
  },
});

/**
 * Corps de purge, exposé aussi comme fonction simple pour que le cron de
 * nettoyage (cleanup.ts) puisse l'appeler directement depuis sa propre
 * mutation (les références internalMutation ne sont pas invocables
 * directement entre mutations).
 */
export async function purgeExpiredRows(ctx: MutationCtx): Promise<{ deleted: number }> {
  const cutoff = Date.now() - RATE_LIMIT_RETENTION_MS;
  const rows = await ctx.db.query("rate_limits").collect();
  let deleted = 0;
  for (const row of rows) {
    if (row.updatedAt < cutoff) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  return { deleted };
}

/** Purge les seaux inactifs (appelé par le cron hebdomadaire). */
export const purgeExpired = internalMutation({
  args: {},
  handler: async (ctx) => purgeExpiredRows(ctx),
});
