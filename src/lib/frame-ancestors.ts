/**
 * Helpers purs d'évaluation de la politique anti-clickjacking
 * (directive CSP `frame-ancestors` + X-Frame-Options).
 *
 * La politique effective est définie dans :
 *  - production : `public/_headers` → `frame-ancestors 'none'` +
 *    `X-Frame-Options: DENY` (l'application n'a AUCUN besoin légitime
 *    d'être intégrée en iframe en production) ;
 *  - aperçu de dev : `vite.config.ts` → `server.headers` avec une liste
 *    d'origines explicitement nécessaires (la plateforme Freebuff affiche
 *    l'aperçu dans une iframe).
 *
 * Ces fonctions ne servent pas à « remplacer » le contrôle serveur par du
 * JS : elles sont utilisées par la suite de tests pour vérifier que la
 * politique APPLIQUÉE refuse effectivement les origines non autorisées.
 */

/**
 * Extrait la liste des sources de la directive `frame-ancestors` d'un
 * en-tête Content-Security-Policy (chaîne brute, plusieurs directives
 * possibles).
 */
export function parseFrameAncestors(csp: string): string[] {
  const match = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (!match) return [];
  return match[1].trim().split(/\s+/).filter(Boolean);
}

/**
 * Une origine peut-elle intégrer l'application dans une iframe, selon la
 * liste de sources `frame-ancestors` ?
 *
 * - `*` → tout est autorisé ;
 * - `'none'` → rien n'est autorisé (production) ;
 * - `'self'` → l'origine du document lui-même (passée en `selfOrigin`) ;
 * - sources d'origine `scheme://host[:port]` avec joker de sous-domaine
 *   `https://*.example.com` → comparaison stricte schéma + hôte (+ port si
 *   précisé). Les mots-clés inconnus ('unsafe-inline', …) sont ignorés.
 */
export function isFramingAllowed(
  directives: string[],
  origin: string,
  selfOrigin?: string,
): boolean {
  if (directives.some((d) => d === "*")) return true;
  if (directives.includes("'none'")) return false;

  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }

  for (const d of directives) {
    if (d === "'self'") {
      if (selfOrigin && sameOrigin(u.toString(), selfOrigin)) return true;
      continue;
    }
    if (d.startsWith("'")) continue; // autre mot-clé CSP → ignoré
    let dd: URL;
    try {
      dd = new URL(d);
    } catch {
      continue;
    }
    if (u.protocol !== dd.protocol) continue;
    if (u.port !== dd.port) continue;
    if (dd.hostname.startsWith("*.")) {
      const suffix = dd.hostname.slice(2); // retire "*."
      if (u.hostname === suffix || u.hostname.endsWith(`.${suffix}`)) {
        return true;
      }
    } else if (u.hostname === dd.hostname) {
      return true;
    }
  }
  return false;
}

function sameOrigin(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    return (
      ua.protocol === ub.protocol &&
      ua.hostname === ub.hostname &&
      ua.port === ub.port
    );
  } catch {
    return false;
  }
}
