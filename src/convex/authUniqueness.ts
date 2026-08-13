/**
 * StudySnap — unicité de l'adresse email (un email = un seul compte).
 *
 * Contrainte métier : une adresse email ne peut être associée qu'à UN SEUL
 * compte. Toute tentative d'inscription avec une adresse déjà présente en
 * base est bloquée côté serveur (jamais seulement côté frontend), avec un
 * message dédié : « Adresse email déjà utilisée, connectez-vous avec ».
 *
 * Deux points de contrôle :
 *  - `assertEmailAvailable` (mutation PUBLIQUE) : appelée par l'écran
 *    Connexion/Inscription AVANT de demander un code email ou de créer un
 *    compte par mot de passe → la vérification en base se fait avant
 *    l'envoi du code de vérification, aucun doublon n'est créé.
 *  - `assertEmailConflictFree` (mutation INTERNE) : défense en profondeur,
 *    exécutée dans `emailOtp.sendVerificationRequest` juste avant l'envoi
 *    réel du code → même un appel direct à l'API ne peut pas faire envoyer
 *    un code à une adresse déjà rattachée à un autre compte.
 *
 * Un compte email-otp EXISTANT reste un simple sign-in (autorisé) : seul le
 * cas « l'adresse est prise mais par un autre type de compte (mot de passe…) »
 * est refusé.
 */

import { ConvexError, v } from "convex/values";
import { internalMutation, mutation } from "./_generated/server";

/** Message exact affiché à l'utilisateur en cas de doublon d'adresse. */
export const EMAIL_TAKEN_MESSAGE =
  "Adresse email déjà utilisée, connectez-vous avec.";

/** Même règle de normalisation que `users.accountsByEmail`. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Décision de conflit pour une adresse donnée (logique pure, testable) :
 *  - "signup"  : adresse libre → l'envoi de code peut créer un nouveau compte.
 *  - "signin"  : un compte email-otp existe déjà → simple connexion, autorisée.
 *  - "blocked" : un utilisateur existe avec cet email mais aucun compte
 *                email-otp → l'adresse est prise par un autre type de compte
 *                (mot de passe…) → inscription refusée (un email = un compte).
 */
export function classifyEmailConflict(input: {
  userExists: boolean;
  hasEmailOtpAccount: boolean;
}): "signup" | "signin" | "blocked" {
  if (!input.userExists) return "signup";
  return input.hasEmailOtpAccount ? "signin" : "blocked";
}

function throwEmailTaken(): never {
  throw new ConvexError({
    code: "EMAIL_TAKEN",
    message: EMAIL_TAKEN_MESSAGE,
  });
}

/**
 * INTERNE — vérification avant l'envoi d'un code email-otp (défense en
 * profondeur, côté serveur) : une adresse déjà rattachée à un compte d'un
 * autre type ne doit JAMAIS recevoir de code qui créerait un second compte.
 * Un compte email-otp existant = connexion, autorisée. Sans effet si
 * l'adresse est libre.
 */
export const assertEmailConflictFree = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .collect();
    if (users.length === 0) return; // adresse libre → inscription autorisée

    const emailOtpAccount = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "email-otp").eq("providerAccountId", normalized),
      )
      .unique();

    if (
      classifyEmailConflict({
        userExists: true,
        hasEmailOtpAccount: emailOtpAccount !== null,
      }) === "blocked"
    ) {
      throwEmailTaken();
    }
  },
});

/**
 * PUBLIQUE — vérification d'inscription : l'adresse doit être libre dans la
 * table `users`. Appelée par le frontend AVANT de demander un code email ou
 * de créer un compte par mot de passe. Lève `EMAIL_TAKEN` si un compte
 * existe déjà avec cette adresse (aucun code envoyé, aucun doublon créé).
 */
export const assertEmailAvailable = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const normalized = normalizeEmail(email);
    if (!normalized) return;

    const users = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .collect();
    if (users.length > 0) throwEmailTaken();
  },
});
