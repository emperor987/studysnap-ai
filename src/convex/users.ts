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
 * Comptes associés à une adresse email (écran « Choisir ton compte »).
 *
 * Public (pas d'authentification requise : l'utilisateur n'est pas encore
 * connecté). Retourne uniquement des informations d'affichage : nom,
 * email, providers de connexion (mot de passe / code email / invité…).
 * Une même adresse peut correspondre à plusieurs comptes StudySnap
 * (ex. un compte créé par mot de passe et un autre via un code email).
 */
export const accountsByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return { accounts: [] };

    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .collect();

    const accounts = await Promise.all(
      users.map(async (u) => {
        const authAccounts = await ctx.db
          .query("authAccounts")
          .withIndex("userIdAndProvider", (q) => q.eq("userId", u._id))
          .collect();
        return {
          userId: u._id,
          name: u.name ?? u.firstName ?? null,
          email: u.email ?? normalized,
          isAnonymous: u.isAnonymous ?? false,
          providers: authAccounts.map((a) => a.provider),
        };
      }),
    );

    return { accounts };
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
    language: v.optional(v.string()),      explanationLevel: v.optional(v.string()),
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

