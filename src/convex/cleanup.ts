import { internalMutation } from "./_generated/server";
import { purgeExpiredRows } from "./rateLimit";

/**
 * Purge hebdomadaire (planifiée dans crons.ts) : supprime les photos de
 * devoirs plus anciennes que IMAGE_RETENTION_DAYS (défaut 30 jours).
 * Les URLs d'images Convex étant signées et temporaires, les liens expirés
 * deviennent inaccessibles.
 *
 * Fonction INTERNE (cron uniquement) : une purge déclenchée par un client
 * arbitraire serait une opération destructive abusable (DoS sur le
 * nettoyage, charge inutile). Le cron appelle internal.cleanup…
 */
export const cleanupExpiredImages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const retentionDays =
      parseInt(process.env.IMAGE_RETENTION_DAYS ?? "30", 10) || 30;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const scans = await ctx.db.query("scans").collect();
    let deleted = 0;
    for (const scan of scans) {
      if (scan.createdAt < cutoff && scan.storageIds.length > 0) {
        for (const id of scan.storageIds) {
          await ctx.storage.delete(id);
          const up = await ctx.db
            .query("uploads")
            .withIndex("by_storage", (q) => q.eq("storageId", id))
            .first();
          if (up) await ctx.db.delete(up._id);
        }
        await ctx.db.patch(scan._id, { storageIds: [] });
        deleted += 1;
      }
    }
    // Purge également les seaux de rate limiting inactifs (> 7 jours).
    await purgeExpiredRows(ctx);
    return { deletedScans: deleted };
  },
});
