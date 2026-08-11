/**
 * StudySnap — accès interne aux données du consentement parental.
 *
 * Les actions ("use node") ne peuvent pas toucher ctx.db directement dans
 * cette version de Convex : elles passent par ces fonctions internes
 * (jamais exposées au client) pour lire et mettre à jour les champs du
 * consentement parental.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export type ParentalUserView = {
  _id: string;
  email: string;
  parentEmail: string;
  parentalConsentStatus: string;
  parentalConsentTokenExpiresAt: number;
  parentalConsentLastSentAt: number;
  isMinor: boolean;
};

/** Lecture d'un utilisateur par hash de token (confirmation parentale). */
export const getUserByTokenHash = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_parental_token", (q) => q.eq("parentalConsentTokenHash", args.tokenHash))
      .first();
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ?? "",
      parentEmail: user.parentEmail ?? "",
      parentalConsentStatus: user.parentalConsentStatus ?? "pending",
      parentalConsentTokenExpiresAt: user.parentalConsentTokenExpiresAt ?? 0,
      parentalConsentLastSentAt: user.parentalConsentLastSentAt ?? 0,
      isMinor: user.isMinor ?? false,
    } satisfies ParentalUserView;
  },
});

/** Lecture des champs parentaux d'un utilisateur (par son id). */
export const getParentalUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;
    return {
      _id: user._id,
      email: user.email ?? "",
      parentEmail: user.parentEmail ?? "",
      parentalConsentStatus: user.parentalConsentStatus ?? "pending",
      parentalConsentTokenExpiresAt: user.parentalConsentTokenExpiresAt ?? 0,
      parentalConsentLastSentAt: user.parentalConsentLastSentAt ?? 0,
      isMinor: user.isMinor ?? false,
    } satisfies ParentalUserView;
  },
});

/** Mise à jour partielle des champs parentaux (les undefined sont ignorés). */
export const patchParentalUser = internalMutation({
  args: {
    userId: v.id("users"),
    isMinor: v.optional(v.boolean()),
    parentEmail: v.optional(v.string()),
    parentalConsentStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("expired"),
        v.literal("refused"),
      ),
    ),
    parentalConsentConfirmedAt: v.optional(v.number()),
    parentalConsentTokenHash: v.optional(v.string()),
    parentalConsentTokenExpiresAt: v.optional(v.number()),
    parentalConsentLastSentAt: v.optional(v.number()),
    parentalConsentReminderSentAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(args)) {
      if (key !== "userId" && value !== undefined) patch[key] = value;
    }
    await ctx.db.patch(args.userId, patch);
  },
});
