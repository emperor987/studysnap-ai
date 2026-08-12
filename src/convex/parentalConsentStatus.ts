/**
 * StudySnap — statut du consentement parental (côté "edge", sans Node.js).
 *
 * Les actions qui envoient des emails et manipulent les tokens vivent dans
 * parentalConsent.ts (module "use node") ; ce module expose la query de
 * statut (bannière frontend) et le cron de rappels.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/** Rappel envoyé après 48 h sans confirmation (le token dure 72 h). */
const REMINDER_AFTER_MS = 48 * 60 * 60 * 1000;

/** Statut courant pour l'utilisateur connecté (bannière / écrans de blocage). */
export const getMyParentalStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user || !user.isMinor) return null;
    return {
      isMinor: true,
      status: (user.parentalConsentStatus ?? "pending") as
        | "pending"
        | "confirmed"
        | "expired"
        | "refused",
      parentEmail: user.parentEmail ?? undefined,
    };
  },
});

/**
 * Cron quotidien : marque "expired" les demandes dont le token a expiré, et
 * envoie un rappel aux parents qui n'ont pas confirmé après 48 h (le rappel
 * génère un nouveau lien de 72 h). Fonction INTERNE (cron uniquement) : un
 * client ne doit pas pouvoir déclencher des envois d'emails en masse.
 */
export const remindPending = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("users")
      .withIndex("by_parental_pending", (q) => q.eq("parentalConsentStatus", "pending"))
      .collect();
    const now = Date.now();
    let reminders = 0;
    let expired = 0;

    for (const user of pending) {
      const expiresAt = user.parentalConsentTokenExpiresAt ?? 0;
      if (expiresAt && now > expiresAt) {
        await ctx.db.patch(user._id, { parentalConsentStatus: "expired" });
        expired += 1;
        continue;
      }
      const lastSent = user.parentalConsentLastSentAt ?? 0;
      if (now - lastSent >= REMINDER_AFTER_MS) {
        // Une mutation ne peut pas appeler une action : on planifie l'envoi.
        await ctx.scheduler.runAfter(
          0,
          internal.parentalConsent.sendReminderForUser,
          { userId: user._id },
        );
        reminders += 1;
      }
    }
    return { reminders, expired };
  },
});
