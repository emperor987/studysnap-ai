/**
 * Security events — journal d'audit des tentatives BLOQUÉES.
 *
 * Quand le rate limiter refuse une requête (génération IA au-dessus du
 * plafond horaire, flood d'emails OTP, etc.), on enregistre une ligne dans
 * `security_events`. C'est la trace « anti-abus » : elle reste visible dans
 * le dashboard Convex (table security_events) sans jamais être exposée au
 * client. Une seule ligne par seau et par fenêtre — la croissance est bornée,
 * et la purge hebdomadaire (cleanup.ts) supprime les lignes de plus de 30 j.
 */
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

/** Rétention des événements de sécurité (alignée sur la purge hebdomadaire). */
export const SECURITY_EVENTS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Enregistre un refus si aucun événement récent n'existe déjà pour ce seau
 * dans la même fenêtre (déduplication : un bot qui martèle n'écrit pas des
 * milliers de lignes, une seule par fenêtre suffit au diagnostic).
 *
 * Fonction utilitaire appelée PAR le rate limiter (même mutation = atomique),
 * jamais directement par le client.
 */
export async function recordDenial(
  ctx: MutationCtx,
  opts: { bucket: string; kind: string; windowStart: number },
): Promise<void> {
  // Déduplication par ÉGALITÉ de fenêtre (windowStart), pas par date : deux
  // fenêtres distinctes peuvent partager la même milliseconde et un refus
  // peut être enregistré dans la même milliseconde que le début de sa
  // fenêtre — comparer des horodatages produirait des faux positifs dans
  // les deux sens. Un événement par seau et par fenêtre : croissance bornée.
  const recent = await ctx.db
    .query("security_events")
    .withIndex("by_bucket", (q) => q.eq("bucket", opts.bucket))
    .collect();
  if (recent.some((e) => e.windowStart === opts.windowStart)) return;
  await ctx.db.insert("security_events", {
    bucket: opts.bucket,
    kind: opts.kind,
    windowStart: opts.windowStart,
    deniedAt: Date.now(),
  });
}

/**
 * Purge les événements plus anciens que la rétention. Corps partagé exposé
 * comme fonction simple pour que le cron (cleanup.ts) puisse l'appeler.
 */
export async function purgeSecurityEvents(
  ctx: MutationCtx,
): Promise<{ deleted: number }> {
  const cutoff = Date.now() - SECURITY_EVENTS_RETENTION_MS;
  const rows = await ctx.db.query("security_events").collect();
  let deleted = 0;
  for (const row of rows) {
    if (row.deniedAt < cutoff) {
      await ctx.db.delete(row._id);
      deleted += 1;
    }
  }
  return { deleted };
}

/** Version interne (cron uniquement) de la purge. */
export const purgeSecurityEventsInternal = internalMutation({
  args: {},
  handler: async (ctx) => purgeSecurityEvents(ctx),
});
