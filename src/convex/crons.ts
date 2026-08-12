import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

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
  internal.cleanup.cleanupExpiredImages,
);

/**
 * Consentement parental : chaque jour, envoie un rappel aux parents qui
 * n'ont pas confirmé après 48 h (nouveau lien de 72 h), et passe en
 * "expired" les demandes dont le token a expiré.
 */
crons.daily(
  "parental consent reminders",
  { hourUTC: 9, minuteUTC: 0 },
  internal.parentalConsentStatus.remindPending,
);

export default crons;
