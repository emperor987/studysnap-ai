/**
 * Validation d'origines / URL construites à partir d'une entrée client.
 *
 * Utilisé pour les liens de confirmation parentale (email) et les URLs de
 * redirection Stripe : une valeur fournie par le client ne doit jamais
 * pouvoir faire pointer un lien de confiance vers un domaine attaquant
 * (phishing + vol de token dans l'email).
 *
 * Deux régimes :
 * - `strict = true` (SITE_URL / CONVEX_SITE_URL configuré, i.e. production) :
 *   seule la base configurée et ses sous-domaines sont acceptés ;
 * - `strict = false` (aucune base configurée, i.e. aperçu de dev) : toute
 *   origine https sans credentials est acceptée — c'est l'origine réelle de
 *   l'aperçu. Les contrôles de protocole (https uniquement) et de credentials
 *   restent actifs dans les deux régimes.
 */

const DEFAULT_BASE = "https://studysnap.app";

/** L'origine correspond-elle à la base de confiance (ou l'un de ses sous-domaines) ? */
export function isAllowedOrigin(origin: string, base: string, strict: boolean): boolean {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.username || u.password) return false;

  if (!strict) {
    // Aucune base configurée : environnement de dev/preview — on accepte
    // toute origine https (c'est l'origine réelle de l'aperçu).
    return true;
  }

  let b: URL;
  try {
    b = new URL(base);
  } catch {
    return false;
  }
  return u.hostname === b.hostname || u.hostname.endsWith(`.${b.hostname}`);
}

/**
 * Résout la base d'URL pour un lien envoyé par email.
 * - si l'utilisateur fournit une origine valide (https, même hôte) → on
 *   l'utilise (l'origine réelle de l'aperçu, nécessaire en dev) ;
 * - sinon → repli sur la base serveur configurée (SITE_URL) ou le défaut.
 */
export function resolveSiteBaseUrl(
  userProvided: string | undefined,
  serverBase: string | undefined,
): string {
  const strict = !!serverBase?.trim();
  const base = serverBase && serverBase.trim() ? serverBase.trim() : DEFAULT_BASE;
  if (!userProvided) return base;
  if (!isAllowedOrigin(userProvided, base, strict)) return base;
  try {
    return new URL(userProvided).origin; // hôte + port, jamais de chemin
  } catch {
    return base;
  }
}

/** La valeur `origin` passée à Stripe pour les URLs success/cancel. */
export function resolveStripeOrigin(
  userProvided: string,
  serverBase: string | undefined,
): string | null {
  const strict = !!serverBase?.trim();
  const base = serverBase && serverBase.trim() ? serverBase.trim() : DEFAULT_BASE;
  if (!isAllowedOrigin(userProvided, base, strict)) return null;
  try {
    return new URL(userProvided).origin;
  } catch {
    return null;
  }
}
