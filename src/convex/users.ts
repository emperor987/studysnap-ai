import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";

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
