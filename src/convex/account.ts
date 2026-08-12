/**
 * StudySnap — droits RGPD : export des données (portabilité) et suppression
 * totale du compte (droit à l'effacement).
 *
 * deleteMyAccount supprime les scans (et leurs images de stockage), les
 * fiches (et leurs images), les quiz, les réponses de quiz, le compteur
 * d'usage et l'abonnement, puis le document utilisateur lui-même.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/** Export JSON complet des données personnelles de l'utilisateur connecté. */
export const exportMyData = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [profile, scans, sheets, quizzes, answers, usage, subscription] =
      await Promise.all([
        ctx.db.get(userId as Id<"users">),
        ctx.db
          .query("scans")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect(),
        ctx.db
          .query("revision_sheets")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect(),
        ctx.db
          .query("quizzes")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect(),
        ctx.db
          .query("quiz_answers")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect(),
        ctx.db
          .query("usage")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .collect(),
        ctx.db
          .query("subscriptions")
          .withIndex("by_user", (q) => q.eq("userId", userId as never))
          .unique(),
      ]);

    return {
      exportedAt: new Date().toISOString(),
      profile: profile
        ? {
            email: profile.email ?? null,
            name: profile.name ?? null,
            firstName: profile.firstName ?? null,
            schoolLevel: profile.schoolLevel ?? null,
            favoriteSubjects: profile.favoriteSubjects ?? [],
            language: profile.language ?? null,
            isMinor: profile.isMinor ?? false,
            createdAt: profile._creationTime,
          }
        : null,
      scans: scans.map((s) => ({
        id: s._id,
        subject: s.subject,
        topic: s.topic ?? null,
        level: s.level,
        title: s.title,
        fullText: s.fullText ?? null,
        mode: s.mode ?? null,
        result: s.result ?? null,
        createdAt: s.createdAt,
      })),
      revisionSheets: sheets.map((s) => ({
        id: s._id,
        title: s.title,
        subject: s.subject,
        level: s.level,
        sourceType: s.sourceType,
        content: s.content,
        createdAt: s.createdAt,
      })),
      quizzes: quizzes.map((q) => ({
        id: q._id,
        subject: q.subject,
        level: q.level,
        title: q.title,
        settings: q.settings,
        questions: q.questions,
        score: q.score ?? null,
        status: q.status,
        createdAt: q.createdAt,
      })),
      quizAnswers: answers.map((a) => ({
        quizId: a.quizId,
        subject: a.subject,
        topic: a.topic ?? null,
        isCorrect: a.isCorrect,
        createdAt: a.createdAt,
      })),
      usage: usage.map((u) => ({
        month: u.month,
        scans: u.scansCount,
        sheets: u.sheetsCount,
        quizzes: u.quizzesCount,
      })),
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            periodEnd: subscription.periodEnd ?? null,
          }
        : null,
    };
  },
});

/** Supprime définitivement le compte et toutes les données associées. */
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    // Scans + images de stockage
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const scan of scans) {
      for (const storageId of scan.storageIds) {
        await ctx.storage.delete(storageId);
      }
      await ctx.db.delete(scan._id);
    }

    // Fiches + images de stockage
    const sheets = await ctx.db
      .query("revision_sheets")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const sheet of sheets) {
      for (const storageId of sheet.storageIds) {
        await ctx.storage.delete(storageId);
      }
      await ctx.db.delete(sheet._id);
    }

    // Quiz, réponses, usage, abonnement
    const quizzes = await ctx.db
      .query("quizzes")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const quiz of quizzes) await ctx.db.delete(quiz._id);

    const answers = await ctx.db
      .query("quiz_answers")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const a of answers) await ctx.db.delete(a._id);

    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const u of usage) await ctx.db.delete(u._id);

    // Registre des fichiers téléversés (sécurité)
    const uploads = await ctx.db
      .query("uploads")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .collect();
    for (const u of uploads) await ctx.db.delete(u._id);

    const subscription = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId as never))
      .unique();
    if (subscription) await ctx.db.delete(subscription._id);

    // Enfin, le document utilisateur (les sessions deviennent inopérantes ;
    // le client appelle signOut() juste après).
    await ctx.db.delete(userId as Id<"users">);
    return { deleted: true };
  },
});
