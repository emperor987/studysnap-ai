/**
 * Validation du paramètre `returnTo` (redirection après connexion).
 *
 * Protection contre l'open redirect : on n'accepte que les chemins relatifs
 * internes du site. Sont rejetés :
 * - les URL absolues (https://evil.com, mailto:…),
 * - les URL protocol-relative (//evil.com),
 * - la variante avec backslash (/\evil.com) que certains navigateurs
 *   normalisent en //evil.com.
 */
export function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
): string {
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    returnTo[1] !== "/" &&
    returnTo[1] !== "\\"
  ) {
    return returnTo;
  }
  return fallback;
}
