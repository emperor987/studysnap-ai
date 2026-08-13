import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  FREE_QUIZ_MAX_QUESTIONS,
  getOrCreateUsage,
  getPlan,
  QUIZ_MAX_QUESTIONS,
} from "./usage";
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

    // Bornes de taille : le client ne contrôle pas la structure (userId,
    // status…) mais on ne lui fait pas non plus confiance sur le volume.
    // Plan gratuit : 5 questions MAX par quiz — re-vérifié ici, même si un
    // client contournait le plafond de generateQuiz (un bot ne peut pas
    // forcer un quiz de 20 questions en appelant saveQuiz directement).
    const maxQuestions = plan === "free" ? FREE_QUIZ_MAX_QUESTIONS : QUIZ_MAX_QUESTIONS;
    const questions = args.questions.slice(0, maxQuestions);
    const count = Math.min(maxQuestions, Math.max(1, Math.round(args.settings.count)));
    const settings = { ...args.settings, count };

    const quizId = await ctx.db.insert("quizzes", {
      userId: userId as never,
      subject: args.subject.slice(0, 100),
      level: args.level.slice(0, 50),
      title: args.title.slice(0, 200),
      settings,
      questions,
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

    const now = Date.now();
    let score = 0;

    // Le score est calculé CÔTÉ SERVEUR : le champ isCorrect envoyé par le
    // client est ignoré (un utilisateur ne peut pas se marquer toutes les
    // réponses comme correctes pour fausser sa progression). La comparaison
    // est identique à celle de l'interface (texte, insensible à la casse).
    for (const a of args.answers.slice(0, quiz.questions.length)) {
      const q = quiz.questions[a.questionIndex];
      if (!q) continue;
      const serverCorrect =
        a.selected !== undefined &&
        a.selected.trim().toLowerCase() === q.answer.trim().toLowerCase();
      if (serverCorrect) score += 1;
      await ctx.db.insert("quiz_answers", {
        userId: userId as never,
        quizId: args.quizId,
        subject: quiz.subject,
        topic: q.topic,
        questionIndex: a.questionIndex,
        selected: a.selected,
        isCorrect: serverCorrect,
        createdAt: now,
      });
    }

    await ctx.db.patch(args.quizId, {
      score,
      total: quiz.questions.length,
      durationSeconds: Math.min(86400, Math.max(0, Math.round(args.durationSeconds))),
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
