import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { CREDIT_PACKS, type CreditPackId } from "./schema";
import type { Id } from "./_generated/dataModel";

/** Coût en crédits par action. */
export const CREDIT_COSTS = {
  scanExplain: 1,   // scan en mode "Cours complet"
  sheet: 1,          // fiche de révision
  quiz: 1,           // quiz personnalisé
} as const;

/** Balance de crédits de l'utilisateur connecté. */
export const getMyBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { balance: 0 };
    const user = await ctx.db.get(userId);
    if (!user) return { balance: 0 };
    return { balance: user.creditBalance ?? 0 };
  },
});

/** Informations détaillées pour la page d'achat. */
export const getMyCreditInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { balance: 0, recentPurchases: [] };
    const user = await ctx.db.get(userId);
    if (!user) return { balance: 0, recentPurchases: [] };
    const purchases = await ctx.db
      .query("credit_purchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    return {
      balance: user.creditBalance ?? 0,
      recentPurchases: purchases.map((p) => ({
        packId: p.packId,
        credits: p.credits,
        amountEur: p.amountEur,
        status: p.status,
        createdAt: p.createdAt,
      })),
    };
  },
});

/** Vérifie que l'utilisateur a assez de crédits. */
export const hasEnoughCredits = query({
  args: { cost: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    if (!user) return false;
    return (user.creditBalance ?? 0) >= args.cost;
  },
});

/** Décrémente les crédits (appelé AVANT chaque action payante). */
export const deductCredits = mutation({
  args: { cost: v.number(), description: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Vous devez être connecté·e.");
    if (args.cost <= 0) throw new Error("Coût invalide.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Utilisateur introuvable.");
    const balance = user.creditBalance ?? 0;
    if (balance < args.cost) {
      throw new Error("INSUFFICIENT_CREDITS");
    }
    await ctx.db.patch(userId, { creditBalance: balance - args.cost });
    return { balance: balance - args.cost };
  },
});

/** Interne : crédite les crédits après un achat validé par le webhook Stripe. */
export const creditAfterPurchase = internalMutation({
  args: {
    userId: v.id("users"),
    credits: v.number(),
    packId: v.string(),
    amountEur: v.number(),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("Utilisateur introuvable.");
    await ctx.db.patch(args.userId, {
      creditBalance: (user.creditBalance ?? 0) + args.credits,
    });
    await ctx.db.insert("credit_purchases", {
      userId: args.userId,
      packId: args.packId,
      credits: args.credits,
      amountEur: args.amountEur,
      stripeSessionId: args.stripeSessionId,
      status: "completed",
      createdAt: Date.now(),
    });
  },
});

/** Interne : enregistre un achat en attente (créé au moment du checkout). */
export const recordPendingPurchase = internalMutation({
  args: {
    userId: v.id("users"),
    packId: v.string(),
    credits: v.number(),
    amountEur: v.number(),
    stripeSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("credit_purchases", {
      userId: args.userId,
      packId: args.packId,
      credits: args.credits,
      amountEur: args.amountEur,
      stripeSessionId: args.stripeSessionId,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

/** Interne : trouve un achat par session Stripe. */
export const findPurchaseBySession = internalQuery({
  args: { stripeSessionId: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("credit_purchases")
      .filter((q) => q.eq(q.field("stripeSessionId"), args.stripeSessionId))
      .first();
    return all;
  },
});

/** Retourne les infos d'un pack par son ID. */
export function getPackInfo(packId: string) {
  return CREDIT_PACKS[packId as CreditPackId] ?? null;
}

/** Interne : récupère la config Stripe existante. */
export const findStripeConfig = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("stripe_config")
      .withIndex("by_singleton", (q) => q.eq("singleton", "default"))
      .unique();
  },
});

/** Interne : upsert de la config Stripe. */
export const upsertConfig = internalMutation({
  args: {
    singleton: v.literal("default"),
    accountId: v.optional(v.string()),
    mode: v.string(),
    priceDecouverte: v.string(),
    priceStandard: v.string(),
    priceGrosBesoin: v.string(),
    webhookId: v.string(),
    webhookSecret: v.string(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_config")
      .withIndex("by_singleton", (q) => q.eq("singleton", "default"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }
    return await ctx.db.insert("stripe_config", args);
  },
});
