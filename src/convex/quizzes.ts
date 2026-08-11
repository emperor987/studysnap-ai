import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOrCreateUsage, getPlan } from "./usage";
import { assertParentalConsent } from "./users";

const questionValidator = v.object({
  type: v.union(
    v.literal("qcm"),
    v.literal("truefalse"),
    v.literal("free"),
    v.literal("problem"),
  ),
  question: v.string(),
  options: v.optional(v.array(v.string())),
  answer: v.string(),
  explanation: v.string(),
  topic: v.optional(v.string()),
});

/** Enregistre un quiz généré (le plan gratuit en autorise 3 par mois). */
export const saveQuiz = mutation({
  args: {
    subject: v.string(),
    level: v.string(),
    title: v.string(),
    settings: v.object({
      count: v.number(),
      difficulty: v.string(),
      types: v.array(
        v.union(
          v.literal("qcm"),
          v.literal("truefalse"),
          v.literal("free"),
          v.literal("problem"),
        ),
      ),
    }),
    questions: v.array(questionValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertParentalConsent(ctx, userId);

    const plan = await getPlan(ctx, userId);
    const usage = await getOrCreateUsage(ctx, userId);
    if (plan === "free" && usage.quizzesCount >= 3) {
      throw new ConvexError({
        code: "LIMIT_REACHED",
        plan,
        message: "Tu as utilisé tes 3 quiz gratuits de ce mois.",
      });
    }

    const quizId = await ctx.db.insert("quizzes", {
      userId: userId as never,
      subject: args.subject,
      level: args.level,
      title: args.title,
      settings: args.settings,
      questions: args.questions,
      status: "pending",
      createdAt: Date.now(),
    });

    await ctx.db.patch(usage._id, {
      quizzesCount: usage.quizzesCount + 1,
      updatedAt: Date.now(),
    });
    return quizId;
  },
});

/** Enregistre les réponses d'un quiz terminé et calcule le score. */
export const saveQuizResult = mutation({
  args: {
    quizId: v.id("quizzes"),
    answers: v.array(
      v.object({
        questionIndex: v.number(),
        selected: v.optional(v.string()),
        isCorrect: v.boolean(),
      }),
    ),
    durationSeconds: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== userId) return null;

    const score = args.answers.filter((a) => a.isCorrect).length;
    const now = Date.now();

    for (const a of args.answers) {
      const q = quiz.questions[a.questionIndex];
      if (!q) continue;
      await ctx.db.insert("quiz_answers", {
        userId: userId as never,
        quizId: args.quizId,
        subject: quiz.subject,
        topic: q.topic,
        questionIndex: a.questionIndex,
        selected: a.selected,
        isCorrect: a.isCorrect,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.quizId, {
      score,
      total: quiz.questions.length,
      durationSeconds: args.durationSeconds,
      status: "done",
    });
    return { score, total: quiz.questions.length };
  },
});

export const listMyQuizzes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("quizzes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getQuiz = query({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== userId) return null;
    return quiz;
  },
});

export const deleteQuiz = mutation({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const quiz = await ctx.db.get(args.quizId);
    if (!quiz || quiz.userId !== userId) return;
    await ctx.db.delete(args.quizId);
  },
});
