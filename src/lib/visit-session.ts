/**
 * Session « par visite » de StudySnap.
 *
 * Problème corrigé : @convex-dev/auth persistait les jetons d'authentification
 * (JWT + refresh token) dans `localStorage`, dont la durée de vie est
 * illimitée → un utilisateur revenant sur l'app était reconnecté
 * silencieusement, sans repasser par l'écran de connexion.
 *
 * Correctif : les jetons vivent désormais dans `sessionStorage`, dont la
 * durée de vie est celle de l'onglet / de la session du navigateur. Fermer
 * l'app puis la rouvrir = session vide → l'utilisateur doit se réauthentifier
 * explicitement (email + mot de passe). Pendant une visite, le parcours est
 * inchangé : navigation SPA, rotation du refresh token, multi-onglets
 * indépendants.
 *
 * La sécurité existante est conservée : validation de signature des jetons,
 * rotation de session à chaque connexion (anti-fixation) et expiration
 * absolue (14 jours) restent gérées côté serveur par Convex Auth.
 *
 * Logique pure, testable en unitaire — consommée par src/main.tsx.
 */

/** Préfixe des clés utilisées par @convex-dev/auth (JWT, refresh token, …). */
export const CONVEX_AUTH_STORAGE_PREFIX = "__convexAuth";

/** Interface minimale du stockage de jetons (compatible `Storage`). */
export interface TokenStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
  length?: number;
}

/** Une clé appartient-elle au stockage de Convex Auth (jetons de session) ? */
export function isConvexAuthStorageKey(key: string): boolean {
  return key.startsWith(CONVEX_AUTH_STORAGE_PREFIX);
}

/**
 * Stockage des jetons de session : `sessionStorage` (durée de vie = onglet).
 * Une visite = un onglet ouvert : en rouvrant l'app, plus aucun jeton →
 * écran de connexion. Retourne `undefined` hors navigateur (repli du
 * provider) ou si l'accès est bloqué (iframe sandbox) — dans ce cas le
 * nettoyage au boot empêche toute session persistante de se rétablir.
 */
export function getVisitTokenStorage(): TokenStorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const storage = window.sessionStorage;
    // Sonde : déclenche tôt une éventuelle erreur d'accès (sandbox).
    storage.getItem("__studysnap.visit-probe");
    return storage;
  } catch {
    return undefined;
  }
}

/**
 * Supprime les jetons Convex Auth laissés dans le stockage PERSISTANT
 * (`localStorage`) par les versions antérieures de l'app. Exécuté à chaque
 * démarrage : garantit qu'aucune session ancienne ne peut reconnecter
 * silencieusement, même dans le cas où `sessionStorage` serait indisponible
 * (le provider retomberait alors sur `localStorage`).
 *
 * @returns le nombre de clés supprimées.
 */
export function clearLegacyPersistentAuthTokens(
  storage: Pick<TokenStorageLike, "getItem" | "removeItem" | "key" | "length">,
): number {
  if (!storage || typeof storage.length !== "number" || storage.length <= 0) {
    return 0;
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key?.(i);
    if (key && isConvexAuthStorageKey(key)) keysToRemove.push(key);
  }
  let removed = 0;
  for (const key of keysToRemove) {
    try {
      storage.removeItem(key);
      removed += 1;
    } catch {
      // Clé illisible (sandbox) → ignorée, on continue.
    }
  }
  return removed;
}
