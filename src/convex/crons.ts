import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ─── Monitoring du plan gratuit ─────────────────────────────────────────────

/**
 * Health check : toutes les 6 heures, compte les lignes de chaque table
 * et enregistre un snapshot dans Convex.
 * Les alertes (seuils warn/crit) sont loguées dans les logs Convex.
 * Les alertes email et le backup Supabase sont gérés par des actions
 * admin séparées (src/convex/alerting.ts, src/convex/backup.ts).
 */
crons.cron(
  "convex health check",
  "0 0,6,12,18 * * *",
  internal.monitoring.recordHealthSnapshot,
);

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

/**
 * Comptes invités (démo, sans compte) : chaque jour, purge les sessions
 * abandonnées (onglet fermé sans déconnexion) — aucune donnée d'invité ne
 * persiste au-delà de sa visite.
 */
crons.daily(
  "cleanup guest accounts",
  { hourUTC: 4, minuteUTC: 30 },
  internal.guest.cleanupGuestAccounts,
);

export default crons;
