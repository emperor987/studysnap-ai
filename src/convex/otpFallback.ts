import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * Stocke un code OTP en fallback quand l'envoi email échoue. Le code est
 * temporairement accessible côté client pour affichage à l'écran.
 * Auto-purgé après 15 minutes par la query getFallbackOtp.
 */
export const storeFallbackOtp = internalMutation({
  args: {
    email: v.string(),
    token: v.string(),
  },
  handler: async (ctx, args) => {
    // Purge les anciens fallbacks pour cette adresse (> 15 min)
    const cutoff = Date.now() - 15 * 60 * 1000;
    const old = await ctx.db
      .query("otp_fallback")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();
    for (const doc of old) {
      if (doc.createdAt < cutoff) {
        await ctx.db.delete(doc._id);
      }
    }
    // Insérer le nouveau fallback
    await ctx.db.insert("otp_fallback", {
      email: args.email,
      token: args.token,
      createdAt: Date.now(),
    });
  },
});

/**
 * Récupère le dernier OTP fallback pour une adresse email (< 15 min).
 * Utilisé par le frontend quand l'envoi email a échoué.
 * Ne supprime pas le document (query = read-only) ; la purge est
 * assurée par storeFallbackOtp au prochain envoi.
 */
export const getFallbackOtp = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const result = await ctx.db
      .query("otp_fallback")
      .withIndex("by_email", (q) =>
        q.eq("email", args.email).gte("createdAt", cutoff),
      )
      .order("desc")
      .first();
    if (!result) return null;
    return { token: result.token };
  },
});
