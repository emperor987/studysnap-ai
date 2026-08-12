/**
 * Paywall « aperçu gratuit vs fichier complet » — Réponse rapide & Révision.
 *
 * Le serveur ne renvoie JAMAIS le contenu complet à un compte gratuit
 * (getScan / getSheet masquent ce qui est réservé aux plans payants). Ces
 * helpers construisent la version « aperçu » : les premiers éléments sont
 * visibles, le reste est retiré et remplacé par des blocs masqués que le
 * frontend affiche floutés avec le bouton « Débloquer le fichier complet ».
 *
 * Les helpers sont purs et testables (aucune dépendance Convex).
 */

import type {
  GatedDocument,
  GatedSheet,
  ScanDocument,
  SheetContent,
} from "./document";

/** Nombre d'exercices entièrement visibles dans l'aperçu gratuit. */
export const DOCUMENT_PREVIEW_EXERCISES = 1;

/** Nombre de concepts visibles dans l'aperçu gratuit d'une fiche. */
export const SHEET_PREVIEW_CONCEPTS = 2;

/**
 * Aperçu gratuit d'un document corrigé : le premier exercice (question +
 * réponse) est visible, les suivants sont masqués.
 */
export function gateDocument(
  doc: ScanDocument | undefined,
): GatedDocument | undefined {
  if (!doc) return undefined;
  const exercises = doc.exercises ?? [];
  const preview = exercises.slice(0, DOCUMENT_PREVIEW_EXERCISES);
  return {
    title: doc.title,
    exercises: preview,
    totalExercises: exercises.length,
    locked: true,
  };
}

/**
 * Aperçu gratuit d'une fiche de révision : quelques concepts visibles,
 * formules / méthodes / exemple / pièges / à retenir masqués.
 */
export function gateSheetContent(content: SheetContent): GatedSheet {
  const concepts = (content.concepts ?? []).slice(0, SHEET_PREVIEW_CONCEPTS);
  return {
    content: {
      concepts,
      formulas: [],
      methods: [],
      example: { question: "", solution: "" },
      pitfalls: [],
      takeaways: [],
    },
    locked: true,
    summary: {
      concepts: (content.concepts ?? []).length,
      formulas: (content.formulas ?? []).length,
    },
  };
}

/** Compteurs dérivés d'une fiche complète (affichés même aux gratuits). */
export function sheetSummary(content: SheetContent): {
  concepts: number;
  formulas: number;
} {
  return {
    concepts: (content.concepts ?? []).length,
    formulas: (content.formulas ?? []).length,
  };
}
