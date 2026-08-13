import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { planValidator } from "./schema";

/** Plan actuel de l'utilisateur connecté. */
export const getMyPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { plan: "free" as const, status: "none", periodEnd: undefined };
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      return { plan: sub.plan, status: sub.status, periodEnd: sub.periodEnd };
    }
    return { plan: "free" as const, status: "none", periodEnd: undefined };
  },
});

/** Interne (webhook Stripe) : crée ou met à jour l'abonnement d'un utilisateur. */
export const upsertSubscription = internalMutation({
  args: {
    userId: v.string(),
    plan: planValidator,
    status: v.string(),
    customerId: v.optional(v.string()),
    subscriptionId: v.optional(v.string()),
    periodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as never))
      .unique();
    const patch = {
      plan: args.plan,
      status: args.status,
      updatedAt: Date.now(),
      ...(args.customerId ? { stripeCustomerId: args.customerId } : {}),
      ...(args.subscriptionId ? { stripeSubscriptionId: args.subscriptionId } : {}),
      ...(args.periodEnd !== undefined ? { periodEnd: args.periodEnd } : {}),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("subscriptions", {
      userId: args.userId as never,
      ...patch,
      createdAt: Date.now(),
    });
  },
});

/**
 * Interne (webhook Stripe) : synchronise le statut d'un abonnement depuis
 * Stripe (customer.subscription.updated, invoice.payment_failed…). Un statut
 * autre qu'actif/trial (past_due, unpaid…) retire automatiquement l'accès
 * payant via getMyPlan — c'est la gestion d'échec de paiement côté app.
 */
export const syncSubscriptionStatus = internalMutation({
  args: {
    customerId: v.string(),
    status: v.string(),
    periodEnd: v.optional(v.number()),
    subscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("stripeCustomerId", args.customerId as never))
      .first();
    if (!sub) return null;
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.periodEnd !== undefined) patch.periodEnd = args.periodEnd;
    if (args.subscriptionId) patch.stripeSubscriptionId = args.subscriptionId;
    await ctx.db.patch(sub._id, patch);
    return sub._id;
  },
});

/** Interne (webhook Stripe) : passe l'abonnement à "canceled". */
export const cancelSubscription = internalMutation({
  args: { customerId: v.string() },
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_customer", (q) => q.eq("stripeCustomerId", args.customerId as never))
      .first();
    if (sub) {
      await ctx.db.patch(sub._id, { status: "canceled", updatedAt: Date.now() });
    }
  },
});
