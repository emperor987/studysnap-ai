/**
 * Traduction des erreurs IA (actions Convex) en messages utilisateur clairs.
 * Le serveur lève des erreurs avec des messages sentinelles ; on les
 * reconnaît ici pour afficher le bon message en français.
 */

export const AI_RATE_LIMITED_MESSAGE = "AI_RATE_LIMITED";

/** Retourne un message utilisateur si l'erreur est connue, sinon null. */
export function getAiErrorMessage(e: unknown): string | null {
  if (e instanceof Error && e.message === AI_RATE_LIMITED_MESSAGE) {
    return "Trop de demandes, réessaie dans quelques instants.";
  }
  return null;
}

/** Message générique pour toute autre erreur d'analyse. */
export const AI_GENERIC_ERROR_MESSAGE =
  "L'analyse a échoué. Réessaie avec une photo plus nette.";
