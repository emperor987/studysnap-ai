/**
 * Types partagés (client + serveur) pour le « document complet corrigé »
 * généré par l'IA quand on scanne un énoncé (devoir, contrôle, QCM…).
 *
 * Le document contient UN bloc par exercice présent sur la photo, avec la
 * réponse correspondante clairement associée — c'est le contenu exportable
 * en PDF, réservé aux plans payants.
 */

export interface DocumentExercise {
  /** Numéro de l'exercice dans l'énoncé (1, 2, 3…). */
  number: number;
  /** L'énoncé / la question de l'exercice, tel que lu sur la photo. */
  question: string;
  /** La réponse complète, rédigée et pédagogique. */
  answer: string;
  /** Le calcul / la démarche essentielle (une à quelques lignes). */
  calculation: string;
}

export interface ScanDocument {
  /** Titre du document, ex. « Correction complète — Devoir de maths ». */
  title: string;
  /** Tous les exercices de l'énoncé, dans l'ordre. */
  exercises: DocumentExercise[];
}

export interface SheetConcept {
  term: string;
  definition: string;
}

export interface SheetFormula {
  name: string;
  formula: string;
}

export interface SheetContent {
  concepts: SheetConcept[];
  formulas: SheetFormula[];
  methods: string[];
  example: { question: string; solution: string };
  pitfalls: string[];
  takeaways: string[];
}

/** Contenu d'un document après passage par le paywall (plan gratuit). */
export interface GatedDocument {
  title: string;
  exercises: DocumentExercise[];
  totalExercises: number;
  locked: boolean;
}

/** Fiche de révision après passage par le paywall (plan gratuit). */
export interface GatedSheet {
  content: SheetContent;
  locked: boolean;
  /** Compteurs toujours visibles (liste de fiches) même quand le contenu est masqué. */
  summary: { concepts: number; formulas: number };
}
