import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

/** Génère un code de parrainage unique alphanum (6-8 chars) pour l'utilisateur connecté. Idempotent. */
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 7; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** Retourne (ou génère) le code de parrainage de l'utilisateur connecté. */
export const getMyReferralCode = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Utilisateur introuvable");

    if (user.referralCode) return user.referralCode;

    // Générer un code unique (retry si collision)
    let code = generateCode();
    for (let attempt = 0; attempt < 10; attempt++) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_referral_code", (q) => q.eq("referralCode", code))
        .first();
      if (!existing) break;
      code = generateCode();
    }

    await ctx.db.patch(userId, { referralCode: code });
    return code;
  },
});

/** Applique un parrainage : l'utilisateur courant est un filleul du parrain identifié par `code`. */
export const applyReferralCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Non authentifié");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("Utilisateur introuvable");
    if (user.referredBy) return { applied: false, reason: "already_referred" };

    const normalized = code.trim().toUpperCase();
    if (!normalized) return { applied: false, reason: "empty_code" };

    // Trouver le parrain
    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referral_code", (q) => q.eq("referralCode", normalized))
      .first();
    if (!referrer) return { applied: false, reason: "code_not_found" };
    if (referrer._id === userId) return { applied: false, reason: "self_referral" };

    // Enregistrer le lien
    await ctx.db.patch(userId, { referredBy: referrer._id });

    // Créer l'entrée de suivi
    await ctx.db.insert("referrals", {
      referrerId: referrer._id,
      referredId: userId,
      createdAt: Date.now(),
    });

    return { applied: true, referrerName: referrer.firstName ?? referrer.name ?? "Ton parrain" };
  },
});

/** Stats de parrainage pour l'utilisateur connecté. */
export const getMyReferralStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { signups: 0, premium: 0, bonusDays: 0 };

    const rows = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .collect();

    const signups = rows.length;
    const premium = rows.filter((r) => r.becamePremium === true).length;
    const bonusDays = rows.reduce((sum, r) => sum + (r.premiumGrantedDays ?? 0), 0);

    return { signups, premium, bonusDays };
  },
});

/**
 * Accorde +7 jours premium au parrain d'un filleul qui vient d'acheter un pack.
 * Appelé depuis le webhook Stripe après confirmation du paiement.
 * Anti-abus : un même filleul ne déclenche le bonus qu'une seule fois.
 */
export const grantReferralBonus = internalMutation({
  args: { referredUserId: v.id("users") },
  handler: async (ctx, { referredUserId }) => {
    const referred = await ctx.db.get(referredUserId);
    if (!referred?.referredBy) return { granted: false, reason: "no_referrer" };

    // Vérifier si le bonus a déjà été accordé pour ce filleul
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredId", referredUserId))
      .first();
    if (existing?.becamePremium) return { granted: false, reason: "already_granted" };

    const REFERRAL_BONUS_DAYS = 7;
    const now = Date.now();
    const referrer = await ctx.db.get(referred.referredBy);
    if (!referrer) return { granted: false, reason: "referrer_not_found" };

    // Mettre à jour la ligne de suivi
    if (existing) {
      await ctx.db.patch(existing._id, {
        becamePremium: true,
        premiumGrantedDays: REFERRAL_BONUS_DAYS,
      });
    }

    // Mettre à jour le compteur cumulé du parrain
    const currentBonus = referrer.referralPremiumGrantedDays ?? 0;
    await ctx.db.patch(referred.referredBy, {
      referralPremiumGrantedDays: currentBonus + REFERRAL_BONUS_DAYS,
    });

    return { granted: true, bonusDays: REFERRAL_BONUS_DAYS };
  },
});
