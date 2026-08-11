import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

/** Limites mensuelles du plan gratuit (fair-use) */
export const FREE_LIMITS = {
  scans: 5,
  sheets: 3,
  quizzes: 3,
} as const;

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Récupère (ou crée) le compteur d'usage du mois courant pour un utilisateur. */
export async function getOrCreateUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"usage">> {
  const month = currentMonth();
  const existing = await ctx.db
    .query("usage")
    .withIndex("by_user_month", (q) => q.eq("userId", userId).eq("month", month))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("usage", {
    userId,
    month,
    scansCount: 0,
    sheetsCount: 0,
    quizzesCount: 0,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Impossible de créer le compteur d'usage.");
  return created;
}

export async function getPlan(ctx: MutationCtx | QueryCtx, userId: Id<"users">) {
  const sub = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (sub && (sub.status === "active" || sub.status === "trialing")) {
    return sub.plan;
  }
  return "free" as const;
}

/** Incrémente un compteur mensuel (avec limite appliquée par l'appelant). */
export async function bumpUsage(
  ctx: MutationCtx,
  userId: Id<"users">,
  field: "scansCount" | "sheetsCount" | "quizzesCount",
) {
  const usage = await getOrCreateUsage(ctx, userId);
  await ctx.db.patch(usage._id, {
    [field]: usage[field] + 1,
    updatedAt: Date.now(),
  });
}

export const getMyUsage = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const plan = await getPlan(ctx, userId);
    const usage = await ctx.db
      .query("usage")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("month", currentMonth()),
      )
      .unique();
    const limits =
      plan === "free" ? FREE_LIMITS : { scans: 9999, sheets: 9999, quizzes: 9999 };
    return {
      plan,
      month: currentMonth(),
      usage: {
        scans: usage?.scansCount ?? 0,
        sheets: usage?.sheetsCount ?? 0,
        quizzes: usage?.quizzesCount ?? 0,
      },
      limits,
    };
  },
});

/** Statistiques agrégées pour l'écran Progression. */
export const getMyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [scans, quizzes, answers] = await Promise.all([
      ctx.db
        .query("scans")
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
    ]);

    // % de réussite par matière (depuis les quiz terminés)
    const bySubject = new Map<string, { correct: number; total: number }>();
    for (const a of answers) {
      const entry = bySubject.get(a.subject) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      bySubject.set(a.subject, entry);
    }

    // Notions faibles (topics avec < 60% de réussite et au moins 2 tentatives)
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const a of answers) {
      const t = a.topic ?? "Général";
      const entry = byTopic.get(t) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      byTopic.set(t, entry);
    }
    const weakTopics = [...byTopic.entries()]
      .map(([topic, s]) => ({ topic, rate: Math.round((s.correct / s.total) * 100), total: s.total }))
      .filter((s) => s.rate < 60 && s.total >= 1)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 6);

    // Activité des 30 derniers jours (scans + quiz)
    const days: { date: string; label: string; scans: number; quizzes: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        scans: 0,
        quizzes: 0,
      });
    }
    const dayKey = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const dayIndex = new Map(days.map((d, i) => [d.date, i]));
    for (const s of scans) {
      const i = dayIndex.get(dayKey(s.createdAt));
      if (i !== undefined) days[i].scans += 1;
    }
    for (const q of quizzes) {
      const i = dayIndex.get(dayKey(q.createdAt));
      if (i !== undefined) days[i].quizzes += 1;
    }

    return {
      scansCount: scans.length,
      quizzesCount: quizzes.filter((q) => q.status === "done").length,
      totalQuestions: answers.length,
      totalCorrect: answers.filter((a) => a.isCorrect).length,
      globalRate: answers.length
        ? Math.round((answers.filter((a) => a.isCorrect).length / answers.length) * 100)
        : 0,
      bySubject: [...bySubject.entries()]
        .map(([subject, s]) => ({
          subject,
          rate: Math.round((s.correct / s.total) * 100),
          total: s.total,
        }))
        .sort((a, b) => b.rate - a.rate),
      weakTopics,
      studyMinutes: Math.round(
        quizzes.reduce((sum, q) => sum + (q.durationSeconds ?? 0), 0) / 60,
      ),
      activity: days,
    };
  },
});
