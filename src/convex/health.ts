/**
 * Endpoint de contrôle santé PUBLIC (GET /health).
 *
 * Sert aux surveillances de disponibilité (UptimeRobot, Better Stack, ping
 * planifié…) : réponse 200 JSON tant que le backend Convex répond, sans
 * jamais exposer d'informations internes (pas de version, pas de chemins,
 * pas de noms de variables, pas d'état des clés).
 */
import { httpAction } from "./_generated/server";

export const health = httpAction(async () => {
  return new Response(
    JSON.stringify({ status: "ok", service: "studysnap-backend", time: Date.now() }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
});
