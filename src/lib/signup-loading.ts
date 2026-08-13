/**
 * Écran de chargement d'inscription (après validation du code reçu par email).
 *
 * Logique pure, testable en unitaire — le composant React (src/pages/Auth.tsx)
 * consomme ces constantes et prédicats, il ne contient que l'affichage.
 *
 * RAPPEL : cet écran n'apparaît QUE lors d'une inscription par code email,
 * c'est-à-dire quand l'adresse saisie n'est associée à aucun compte existant
 * (la validation du code crée alors le compte côté backend). Une connexion
 * d'un compte existant garde le flux actuel, sans écran de chargement.
 */

/** Phrases qui défilent en bas de l'écran pendant la création du compte. */
export const SIGNUP_LOADING_PHRASES: readonly string[] = [
  "0/20 au contrôle ? StudySnap t'aidera à remonter la pente.",
  "Pendant que tu lisais ça, quelqu'un a déjà fini ses devoirs avec StudySnap.",
  "Prépare-toi à ne plus jamais bloquer sur un exercice.",
  "StudySnap analyse déjà ta future réussite...",
  "Fini le stress de la veille pour le lendemain.",
  "Ton dashboard arrive, patience...",
] as const;

/** Une nouvelle phrase toutes les ~2,4 s (transition douce entre chacune). */
export const SIGNUP_PHRASE_INTERVAL_MS = 2400;

/** Au-delà de cette durée, on affiche le message de repli : jamais d'écran
 *  de chargement bloqué indéfiniment. */
export const SIGNUP_LOADING_TIMEOUT_MS = 25_000;

/** Durée d'affichage de « Chargement terminé ! » avant l'ouverture du
 *  dashboard (transition fluide, sans clic). */
export const SIGNUP_DONE_DELAY_MS = 1_200;

/**
 * Un code email correspond à une INSCRIPTION quand l'adresse n'est associée à
 * aucun compte existant au moment de la demande de code : la validation du
 * code créera le compte côté backend (Convex Auth crée l'utilisateur à la
 * première vérification d'un code).
 */
export function isSignupForEmail(accounts: readonly unknown[]): boolean {
  return accounts.length === 0;
}

/**
 * Le chargement est terminé quand la session est confirmée ET que le profil
 * de l'utilisateur (requis par le dashboard) est chargé — c'est-à-dire quand
 * `useAuth().isLoading` est faux et `isAuthenticated` vrai.
 */
export function isAuthReady(input: {
  authenticated: boolean;
  authLoading: boolean;
}): boolean {
  return input.authenticated && !input.authLoading;
}
