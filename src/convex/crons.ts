import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

/**
 * Politique de suppression automatique des photos de devoirs :
 * IMAGE_RETENTION_DAYS (défaut 30) — les images plus anciennes sont purgées
 * chaque dimanche à 03h00 UTC. Les URLs d'images Convex étant signées et
 * temporaires, les liens expirés deviennent inaccessibles bien avant.
 */
const crons = cronJobs();

crons.weekly(
  "cleanup expired exercise images",
  { dayOfWeek: "sunday", hourUTC: 3, minuteUTC: 0 },
  api.cleanup.cleanupExpiredImages,
);

export default crons;
