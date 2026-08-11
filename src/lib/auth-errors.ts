/**
 * Traduction des erreurs du flux d'authentification (Convex Auth) en
 * messages français clairs, pour l'écran Connexion / Inscription.
 *
 * Les erreurs arrivent côté client sous forme de code dans
 * error.data.code (ConvexError) ou error.name/message — on gère les deux.
 */

export function getAuthErrorMessage(e: unknown): string {
  const any = e as {
    data?: { code?: unknown };
    code?: unknown;
    name?: string;
    message?: string;
  };
  const code =
    typeof any?.data?.code === "string"
      ? any.data.code
      : typeof any?.code === "string"
        ? any.code
        : null;
  const hay = (code ?? any?.name ?? any?.message ?? "").toLowerCase();

  if (!hay) return "Une erreur est survenue. Réessaie.";
  if (hay.includes("invalid") || hay.includes("credential")) {
    return "Email ou mot de passe incorrect.";
  }
  if (hay.includes("exist")) {
    return "Un compte existe déjà avec cet email. Connecte-toi.";
  }
  if (hay.includes("too_many") || hay.includes("too many") || hay.includes("rate") || hay.includes("429")) {
    return "Trop de tentatives de connexion. Réessaie dans quelques minutes.";
  }
  if (hay.includes("password")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (hay.includes("code") || hay.includes("expired")) {
    return "Le code est incorrect ou expiré. Redemande un code.";
  }
  return "Une erreur est survenue. Réessaie.";
}
