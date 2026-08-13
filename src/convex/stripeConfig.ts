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
  /** Empreinte du compte Stripe (acct_...) : si elle change (migration de
   *  compte, nouvelle clé), le provisionnement recrée tout sous le nouveau
   *  compte — jamais de price_id / secret d'un ancien compte réutilisés. */
  accountId: string;
  mode: "test" | "live";
  priceStudent: string;
  pricePro: string;
  priceStudentAnnual?: string;
  priceProAnnual?: string;
  webhookId: string;
  webhookSecret: string;
};

const stripeConfigValidator = v.object({
  // Optionnel pour rester compatible avec les configs enregistrées avant
  // l'ajout du champ : elles sont re-provisionnées automatiquement (l'ID
  // manquant ≠ ID du compte courant).
  accountId: v.optional(v.string()),
  mode: v.union(v.literal("test"), v.literal("live")),
  priceStudent: v.string(),
  pricePro: v.string(),
  priceStudentAnnual: v.optional(v.string()),
  priceProAnnual: v.optional(v.string()),
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
    // Anciennes configs (avant l'ajout du mode / du compte) : considérées
    // comme du test, sans compte — le provisionnement les remplacera dès le
    // prochain checkout (accountId manquant ≠ compte courant).
    return {
      accountId: doc.accountId ?? "",
      mode: (doc.mode === "live" ? "live" : "test") as "test" | "live",
      priceStudent: doc.priceStudent,
      pricePro: doc.pricePro,
      priceStudentAnnual: doc.priceStudentAnnual,
      priceProAnnual: doc.priceProAnnual,
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
