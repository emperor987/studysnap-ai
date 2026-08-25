// Server-side Supabase client —仅供 Convex actions ("use node") 使用。
// Lit SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY depuis les variables d'environnement.
// Jamais exposé côté client : les clés sont lues uniquement dans les actions serveur.

"use node";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

/**
 * Retourne un client Supabase configuré avec la service-role key.
 * Le client est mis en cache (une seule instance par processus serveur).
 *
 * @throws {Error} Si SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY est manquant.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL");
    if (!serviceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    throw new Error(
      `[supabase] Clé(s) manquante(s) : ${missing.join(", ")}. ` +
        "Ajoute-la dans l'onglet Keys / API keys de la plateforme.",
    );
  }

  cachedClient = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
