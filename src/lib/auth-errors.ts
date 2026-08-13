/**
 * Traduction des erreurs du flux d'authentification (Convex Auth) en
 * messages français clairs, pour l'écran Connexion / Inscription.
 *
 * Les erreurs arrivent côté client sous forme de code dans
 * error.data.code (ConvexError) ou error.name/message — on gère les deux.
 */
const SERVICE_UNAVAILABLE =
  "Le service est momentanément indisponible. Réessaie dans quelques instants.";

/** Adresse email déjà rattachée à un compte (un email = un seul compte). */
const EMAIL_TAKEN =
  "Adresse email déjà utilisée, connectez-vous avec.";

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
  // On inspecte code + name + message ensemble : pour un `Error` classique,
  // `name` vaut « Error » et c'est `message` qui contient l'information utile.
  const hay = [
    typeof code === "string" ? code : "",
    typeof any?.name === "string" ? any.name : "",
    typeof any?.message === "string" ? any.message : "",
  ]
    .join(" ")
    .toLowerCase();

  if (!hay.trim()) return "Une erreur est survenue. Réessaie.";

  // Backend / réseau injoignable (ex. Convex momentanément indisponible) :
  // détecté AVANT les autres règles, car un message du type
  // « status code 502 » contient aussi « code ».
  const NETWORK_HINTS = [
    "network",
    "fetch",
    "econnrefused",
    "econnreset",
    "unreachable",
    "unavailable",
    "temporarily",
    "timed out",
    "timeout",
    "502",
    "503",
    "504",
  ];
  if (NETWORK_HINTS.some((hint) => hay.includes(hint))) {
    return SERVICE_UNAVAILABLE;
  }

  // Adresse déjà rattachée à un compte — code dédié EMAIL_TAKEN levé par
  // convex/authUniqueness (serveur), ou message du provider.
  if (
    hay.includes("email_taken") ||
    hay.includes("déjà utilisée") ||
    hay.includes("deja utilisee") ||
    hay.includes("already used")
  ) {
    return EMAIL_TAKEN;
  }

  // Configuration serveur incomplète — la cause précise est journalisée côté
  // serveur (dashboard Convex) : jamais de message générique trompeur.
  if (hay.includes("missing environment variable") || hay.includes("missing env")) {
    return "Le service d'envoi de codes est mal configuré. Réessaie dans quelques minutes.";
  }
  if (
    hay.includes("n'est pas configuré") ||
    hay.includes("n'est pas configure") ||
    hay.includes("not configured")
  ) {
    return "Le service d'envoi de codes n'est pas encore configuré. Réessaie dans quelques minutes.";
  }

  // Rate limit d'envoi de codes (avant « code », sinon le mot « code » du
  // message serait mal traduit en « code incorrect »).
  if (hay.includes("trop de demandes") || hay.includes("too many requests")) {
    return "Trop de demandes de code par email. Réessaie dans quelques minutes.";
  }
  if (
    hay.includes("échec de l'envoi") ||
    hay.includes("echec de l'envoi") ||
    hay.includes("envoi du code") ||
    hay.includes("failed to send")
  ) {
    return "L'envoi du code a échoué — réessaie dans un instant.";
  }

  // Mot de passe : à tester avant « invalid »/« credential », sinon
  // « Invalid password » serait traduit en « email ou mot de passe incorrect ».
  if (hay.includes("password")) {
    return "Le mot de passe doit contenir au moins 8 caractères.";
  }
  if (hay.includes("invalid") || hay.includes("credential")) {
    return "Email ou mot de passe incorrect.";
  }
  if (hay.includes("exist")) {
    return "Un compte existe déjà avec cet email. Connecte-toi.";
  }
  if (hay.includes("too_many") || hay.includes("too many") || hay.includes("rate") || hay.includes("429")) {
    return "Trop de tentatives de connexion. Réessaie dans quelques minutes.";
  }
  if (hay.includes("code") || hay.includes("expired")) {
    return "Le code est incorrect ou expiré. Redemande un code.";
  }
  return "Une erreur est survenue. Réessaie.";
}
