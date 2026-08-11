import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Bloque les actions de génération (scan, fiche, quiz) tant que le
 * consentement parental n'est pas confirmé pour un mineur (< 15 ans).
 * Un utilisateur qui n'a pas déclaré être mineur n'est jamais concerné.
 */
export async function assertParentalConsent(
  ctx: QueryCtx,
  userId: string,
) {
  const user = await ctx.db.get(userId as Id<"users">);
  if (user?.isMinor && user.parentalConsentStatus !== "confirmed") {
    throw new ConvexError({
      code: "PARENTAL_PENDING",
      message:
        "Ton compte est en attente de validation par un parent ou tuteur légal — demande-lui de confirmer le lien reçu par email.",
    });
  }
}

/** Met à jour le profil StudySnap de l'utilisateur connecté. */
export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    schoolLevel: v.optional(v.string()),
    favoriteSubjects: v.optional(v.array(v.string())),
    language: v.optional(v.string()),
    explanationLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const patch: Record<string, unknown> = {};
    if (args.firstName !== undefined) {
      patch.firstName = args.firstName;
      if (!args.firstName.trim()) delete patch.firstName;
    }
    if (args.schoolLevel !== undefined) patch.schoolLevel = args.schoolLevel;
    if (args.favoriteSubjects !== undefined) patch.favoriteSubjects = args.favoriteSubjects;
    if (args.language !== undefined) patch.language = args.language;
    if (args.explanationLevel !== undefined) patch.explanationLevel = args.explanationLevel;
    await ctx.db.patch(userId, patch);
    return await ctx.db.get(userId);
  },
});
