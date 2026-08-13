import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/**
 * Mode invité (démo, sans compte) de StudySnap.
 *
 * Un invité est un utilisateur créé par le provider Anonymous de Convex Auth
 * (`users.isAnonymous === true`). Contrairement à un compte gratuit classique,
 * il est soumis à des limites strictes, TOUTES vérifiées côté serveur :
 *
 * - 1 seul scan autorisé (jamais plus), quelle que soit la route empruntée
 *   (recordScan, actions IA, démo) ;
 * - aucun accès aux fiches de révision, quiz, historique ou progression ;
 * - aucune donnée persistée après la session : les données de l'invité sont
 *   supprimées à la déconnexion (wipeMyGuestData) et, pour les sessions
 *   abandonnées (onglet fermé), par le cron quotidien cleanupGuestAccounts.
 *
 * Le client ne peut jamais contourner ces limites : elles sont appliquées
 * dans les mutations (scans, fiches, quiz) ET dans les actions IA, avant
 * toute consommation de génération.
 */

/** Nombre maximal de scans d'un compte invité (démo, sans compte). */
export const GUEST_MAX_SCANS = 1;

/** Message unique affiché à l'invité quand une limite est atteinte. */
export const GUEST_UPGRADE_MESSAGE =
  "Crée ton compte pour continuer à scanner gratuitement.";

/** Code d'erreur Convex exposé au client (pas de détail interne). */
export const GUEST_LIMIT_CODE = "GUEST_LIMIT_REACHED";

/** Lève l'erreur « limite invité atteinte » (message d'inscription clair). */
export function guestLimitError() {
  return new ConvexError({
    code: GUEST_LIMIT_CODE,
    message: GUEST_UPGRADE_MESSAGE,
  });
}

/** L'utilisateur est-il un compte invité (Anonymous) ? */
export async function isGuestUser(
  ctx: Pick<QueryCtx, "db">,
  userId: string,
): Promise<boolean> {
  const user = await ctx.db.get(userId as Id<"users">);
  return user?.isAnonymous === true;
}

/**
 * Interne (actions IA « use node ») : l'utilisateur est-il un invité ?
 * Les actions ne peuvent pas appeler les helpers locaux directement —
 * elles passent par ctx.runQuery.
 */
export const isGuestById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return isGuestUser(ctx, args.userId);
  },
});

/**
 * Supprime TOUTES les données d'un invité (données applicatives, fichiers,
 * compteurs, enregistrements d'auth) puis son compte. Utilisé à la
 * déconnexion d'un invité (rien ne survit à la session) et par le cron de
 * nettoyage des sessions abandonnées.
 */
async function wipeGuestUser(ctx: MutationCtx, userId: Id<"users">) {
  const [scans, sheets, quizzes, answers, uploads, usage, subs, accounts, sessions] =
    await Promise.all([
      ctx.db
        .query("scans")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("revision_sheets")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("quizzes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("quiz_answers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("uploads")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("usage")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect(),
    ]);

  // Fichiers du compte invité (photos scannées) : suppression du stockage +
  // de l'enregistrement uploads.
  for (const s of scans) {
    for (const id of s.storageIds) await ctx.storage.delete(id);
  }
  for (const s of sheets) {
    for (const id of s.storageIds) await ctx.storage.delete(id);
  }
  for (const up of uploads) await ctx.db.delete(up._id);
  for (const s of scans) await ctx.db.delete(s._id);
  for (const s of sheets) await ctx.db.delete(s._id);
  for (const q of quizzes) await ctx.db.delete(q._id);
  for (const a of answers) await ctx.db.delete(a._id);
  for (const u of usage) await ctx.db.delete(u._id);
  for (const s of subs) await ctx.db.delete(s._id);

  // Enregistrements d'auth (sessions, refresh tokens, codes, comptes).
  for (const s of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    for (const t of tokens) await ctx.db.delete(t._id);
    await ctx.db.delete(s._id);
  }
  for (const acc of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", acc._id))
      .collect();
    for (const c of codes) await ctx.db.delete(c._id);
    await ctx.db.delete(acc._id);
  }

  await ctx.db.delete(userId);
  return {
    deletedScans: scans.length,
    deletedSheets: sheets.length,
    deletedQuizzes: quizzes.length,
  };
}

/**
 * Mutation côté client : l'invité connecté supprime immédiatement ses
 * données (appelée à la déconnexion). Ne s'applique qu'aux comptes invités —
 * un compte classique n'est jamais touché.
 */
export const wipeMyGuestData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (!(await isGuestUser(ctx, userId))) return null;
    return await wipeGuestUser(ctx, userId as Id<"users">);
  },
});

/**
 * Interne (cron quotidien) : purge les comptes invités dont la session est
 * abandonnée (dernière activité > GUEST_RETENTION_MS). Un invité qui ferme
 * l'onglet sans se déconnecter ne laisse donc aucune donnée persistante.
 */
export const cleanupGuestAccounts = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 48 h : large marge pour ne jamais supprimer un invité en pleine visite.
    const retentionMs =
      (parseInt(process.env.GUEST_RETENTION_HOURS ?? "48", 10) || 48) *
      60 *
      60 *
      1000;
    const cutoff = Date.now() - retentionMs;
    const users = await ctx.db.query("users").collect();
    const stale = users.filter(
      (u) =>
        u.isAnonymous === true &&
        (u._creationTime === undefined || u._creationTime < cutoff),
    );
    const results = { deleted: 0, scans: 0, sheets: 0, quizzes: 0 };
    for (const u of stale) {
      try {
        const r = await wipeGuestUser(
          ctx as unknown as MutationCtx,
          u._id as Id<"users">,
        );
        results.deleted += 1;
        results.scans += r.deletedScans;
        results.sheets += r.deletedSheets;
        results.quizzes += r.deletedQuizzes;
      } catch (err) {
        // Une erreur isolée ne doit pas interrompre la purge des autres
        // invités (résilience du cron).
        console.error(
          `[guest] Échec de la purge de l'invité ${u._id}:`,
          err,
        );
      }
    }
    return results;
  },
});
