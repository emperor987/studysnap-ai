// THIS FILE IS READ ONLY. Do not touch this file unless you are correctly adding a new auth provider in accordance to the vly auth documentation

import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, emailOtp, Anonymous],
  signIn: {
    // Protection anti brute-force : au-delà de 5 échecs de connexion
    // (mot de passe ou code OTP) par heure et par adresse, Convex Auth
    // bloque la tentative suivante (déblocage progressif ~1/6 min).
    maxFailedAttempsPerHour: 5,
  },
  session: {
    // Expiration ABSOLUE des sessions : 14 jours, même en cas d'utilisation
    // continue (réauthentification périodique). La rotation de session à
    // chaque connexion (anti-fixation) et l'invalidation serveur au logout
    // sont assurées par Convex Auth (createNewAndDeleteExistingSession /
    // suppression du session document + refresh tokens).
    totalDurationMs: 14 * 24 * 60 * 60 * 1000,
  },
});
