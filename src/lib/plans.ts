export type PlanId = "free" | "student" | "pro";

export const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  priceNote: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}[] = [
  {
    id: "free",
    name: "Gratuit",
    price: "0 €",
    priceNote: "/ mois",
    tagline: "Pour tester StudySnap sans engagement.",
    features: [
      "5 scans d'exercices / mois",
      "3 fiches de révision / mois",
      "Quiz limités (3 / mois)",
      "Les 3 modes de réponse",
      "Historique de tes exercices",
    ],
    cta: "Commencer gratuitement",
  },
  {
    id: "student",
    name: "Student",
    price: "9,99 €",
    priceNote: "/ mois",
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
    price: "14,99 €",
    priceNote: "/ mois",
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
