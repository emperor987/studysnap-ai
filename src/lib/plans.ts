export type PlanId = "free" | "student" | "pro";
export type BillingPeriod = "monthly" | "annual";

/** Tarifs en euros (mensuel / annuel) — le produit Stripe est provisionné sur ces montants. */
export const PRICING: Record<"student" | "pro", Record<BillingPeriod, number>> = {
  student: { monthly: 4.99, annual: 49.99 },
  pro: { monthly: 6.99, annual: 69.99 },
};

/** « 4,99 € » au format français. */
export function formatPrice(amount: number): string {
  return `${amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

/** Note de période affichée à côté du prix. */
export function priceNote(billing: BillingPeriod): string {
  return billing === "monthly" ? "/ mois" : "/ an";
}

/** Équivalent mensuel d'un tarif annuel, ex. « ≈ 4,17 €/mois ». */
export function annualMonthlyHint(annual: number): string {
  const perMonth = annual / 12;
  return `≈ ${perMonth.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €/mois`;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "free",
    name: "Gratuit",
    tagline: "Pour tester StudySnap sans engagement.",
    features: [
      "4 scans d'exercices / mois",
      "3 fiches de révision / mois",
      "Quiz de 5 questions max (3 / mois)",
      "Les 3 modes de réponse",
      "Aperçu des documents corrigés complets",
    ],
    cta: "Commencer gratuitement",
  },
  {
    id: "student",
    name: "Student",
    tagline: "L'essentiel pour réviser toute l'année.",
    features: [
      "Scans illimités (fair-use)",
      "Fiches de révision illimitées",
      "Quiz illimités (5-20 questions)",
      "Explications adaptées à ton niveau",
      "Support par email",
    ],
    cta: "Passer à Student",
    highlight: true,
  },
  {
    id: "pro",
    name: "Student Pro",
    tagline: "Pour les grosses révisions et le bac.",
    features: [
      "Tout le plan Student",
      "Analyse multi-pages (plusieurs photos)",
      "Statistiques avancées & progression",
      "Priorité IA (réponses plus rapides)",
      "Export PDF des fiches",
    ],
    cta: "Passer à Student Pro",
  },
];
