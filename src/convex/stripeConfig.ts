/**
 * StudySnap — config Stripe auto-provisionnée (produits, prix, webhook).
 *
 * Fonctions internes uniquement (jamais appelables depuis le client) :
 * la table stripe_config contient les price_id et le secret du webhook,
 * qui ne doivent pas être exposés.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export type StripeConfig = {
  mode: "test" | "live";
  priceStudent: string;
  pricePro: string;
  webhookId: string;
  webhookSecret: string;
};

const stripeConfigValidator = v.object({
  mode: v.union(v.literal("test"), v.literal("live")),
  priceStudent: v.string(),
  pricePro: v.string(),
  webhookId: v.string(),
  webhookSecret: v.string(),
});

/** Config Stripe auto-provisionnée (lecture serveur uniquement). */
export const getStripeConfig = internalQuery({
  args: {},
  handler: async (ctx): Promise<StripeConfig | null> => {
    const doc = await ctx.db
      .query("stripe_config")
      .withIndex("by_singleton", (q) => q.eq("singleton", "default"))
      .first();
    if (!doc) return null;
    // Anciennes configs (avant l'ajout du mode) : considérées comme du test.
    return {
      mode: (doc.mode === "live" ? "live" : "test") as "test" | "live",
      priceStudent: doc.priceStudent,
      pricePro: doc.pricePro,
      webhookId: doc.webhookId,
      webhookSecret: doc.webhookSecret,
    };
  },
});

/** Écrit (ou met à jour) la config Stripe auto-provisionnée. */
export const storeStripeConfig = internalMutation({
  args: stripeConfigValidator,
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
