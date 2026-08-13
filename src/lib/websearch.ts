/**
 * StudySnap — recherche internet de SECOURS pour l'IA d'analyse.
 *
 * Utilisée quand la base de connaissances interne (src/lib/curriculum.ts) ne
 * couvre pas le contenu scanné avec une confiance suffisante : on complète
 * / vérifie l'information avec des résultats web AVANT de générer la
 * réponse, pour ne jamais répondre dans le vide.
 *
 * Fournisseur : Brave Search API (https://brave.com/search/api/) — index
 * indépendant, offre gratuite généreuse, REST simple. Compatible avec tout
 * endpoint Brave (headers X-Subscription-Token).
 *
 * Variables d'environnement (UI Keys de la plateforme) :
 *   SEARCH_API_KEY  — clé Brave (ou BRAVE_API_KEY, alias accepté)
 *   SEARCH_BASE_URL — endpoint (défaut : https://api.search.brave.com/res/v1/web/search)
 *
 * Sans clé configurée, `searchWeb` retourne null : l'IA analyse alors avec
 * la base de connaissances seule + une consigne de prudence (aucune erreur
 * bloquante, aucune clé requise pour que l'app fonctionne).
 */

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export const SEARCH_BASE_URL_DEFAULT =
  "https://api.search.brave.com/res/v1/web/search";

/** Clé Brave configurée (SEARCH_API_KEY ou alias BRAVE_API_KEY). */
export function searchKey(): string | undefined {
  return process.env.SEARCH_API_KEY ?? process.env.BRAVE_API_KEY;
}

/** La recherche de secours est-elle activée (clé présente) ? */
export function searchEnabled(): boolean {
  return Boolean(searchKey()?.trim());
}

/**
 * Interroge l'API Brave Search. Retourne les résultats (≤ maxResults) ou
 * null si : aucune clé, endpoint injoignable, réponse invalide ou timeout.
 * Jamais d'exception : la recherche est un OPT-IN d'enrichissement.
 */
export async function searchWeb(
  query: string,
  opts: { maxResults?: number; signal?: AbortSignal } = {},
): Promise<SearchResult[] | null> {
  const key = searchKey()?.trim();
  if (!key) return null;

  const maxResults = Math.min(8, Math.max(1, opts.maxResults ?? 4));
  const baseUrl = (process.env.SEARCH_BASE_URL ?? SEARCH_BASE_URL_DEFAULT).trim();

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  url.searchParams.set("q", query.slice(0, 300));
  url.searchParams.set("count", String(maxResults));

  const signal =
    opts.signal ?? AbortSignal.timeout(6_000);
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      web?: { results?: { title?: string; url?: string; description?: string }[] };
    };
    const raw = data?.web?.results ?? [];
    const results: SearchResult[] = raw
      .map((r) => ({
        title: (r.title ?? "").trim(),
        url: (r.url ?? "").trim(),
        description: (r.description ?? "").trim(),
      }))
      .filter((r) => r.title.length > 0 || r.description.length > 0)
      .slice(0, maxResults);
    return results.length > 0 ? results : null;
  } catch {
    // Timeout / réseau / format inattendu : la recherche est optionnelle.
    return null;
  }
}

/** Formate les résultats en section compacte pour le prompt IA. */
export function buildSearchContext(results: SearchResult[]): string {
  const lines = [
    "— VÉRIFICATION EXTERNE (recherche documentaire) —",
    "Ces extraits sont une aide de vérification des faits, formules ou définitions. Ne les recopie pas mot pour mot : garde la méthode et les définitions exactes, cite la source si utile.",
  ];
  results.slice(0, 4).forEach((r, i) => {
    const text = [r.title, r.description].filter(Boolean).join(" — ").trim();
    if (!text) return;
    lines.push(
      `${i + 1}. ${text}${r.url ? ` (source : ${r.url})` : ""}`,
    );
  });
  return lines.join("\n");
}
