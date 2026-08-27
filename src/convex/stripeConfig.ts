/**
 * StudySnap — config Stripe auto-provisionnée (produits crédits, webhook).
 *
 * Fonctions internes uniquement (jamais appelables depuis le client).
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export type StripeConfig = {
  accountId: string;
  mode: "test" | "live";
  priceDecouverte: string;
  priceStandard: string;
  priceGrosBesoin: string;
  webhookId: string;
  webhookSecret: string;
};

/** Config Stripe auto-provisionnée (lecture serveur uniquement). */
export const getStripeConfig = internalQuery({
  args: {},
  handler: async (ctx): Promise<StripeConfig | null> => {
    const doc = await ctx.db
      .query("stripe_config")
      .withIndex("by_singleton", (q) => q.eq("singleton", "default"))
      .first();
    if (!doc) return null;
    return {
      accountId: doc.accountId ?? "",
      mode: (doc.mode === "live" ? "live" : "test") as "test" | "live",
      priceDecouverte: doc.priceDecouverte,
      priceStandard: doc.priceStandard,
      priceGrosBesoin: doc.priceGrosBesoin,
      webhookId: doc.webhookId,
      webhookSecret: doc.webhookSecret,
    };
  },
});

/** Écrit (ou met à jour) la config Stripe. */
export const storeStripeConfig = internalMutation({
  args: {
    accountId: v.optional(v.string()),
    mode: v.union(v.literal("test"), v.literal("live")),
    priceDecouverte: v.string(),
    priceStandard: v.string(),
    priceGrosBesoin: v.string(),
    webhookId: v.string(),
    webhookSecret: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_config")
      .withIndex("by_singleton", (q) => q.eq("singleton", "default"))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
    } else {
      await ctx.db.insert("stripe_config", {
        singleton: "default",
        ...args,
        updatedAt: now,
      });
    }
  },
});
