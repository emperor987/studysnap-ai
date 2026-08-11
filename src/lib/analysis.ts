/**
 * Détection du « type d'exercice » à partir du texte extrait par l'OCR :
 * certains énoncés (énoncé long, problème, rédaction, multiples sous-questions)
 * demandent nettement plus de temps de génération à l'IA. On prévient alors
 * l'utilisateur que l'analyse peut prendre 1 à 2 minutes.
 */

const LONG_KEYWORDS = [
  "problème",
  "énoncé",
  "rédiger",
  "rédaction",
  "démontrer",
  "justifier",
  "développer",
  "argumenter",
  "dissertation",
  "composition",
  "paragraphe",
  "document",
  "texte",
];

/**
 * Vrai si l'exercice risque de prendre du temps à analyser :
 *  - texte très long (> 900 caractères), ou
 *  - au moins 4 sous-questions numérotées, ou
 *  - énoncé de taille moyenne avec plusieurs marqueurs d'exercice long
 *    (problème, démontrer, justifier, dissertation…).
 */
export function isLongExercise(text: string): boolean {
  const t = (text ?? "").trim();
  if (t.length < 60) return false;

  if (t.length > 900) return true;

  const subQuestions = (t.match(/\b\d{1,2}\s*[.)]\s/g) || []).length;
  if (subQuestions >= 4) return true;

  const lowered = t.toLowerCase();
  const hits = LONG_KEYWORDS.filter((k) => lowered.includes(k)).length;
  return t.length > 200 && hits >= 2;
}

/** Message d'avertissement affiché pendant l'analyse d'un exercice long. */
export const LONG_ANALYSIS_WARNING =
  "Ce type d'exercice (énoncé long ou problème) demande plus de travail à l'IA : l'analyse peut prendre 1 à 2 minutes. Elle est en cours — pas besoin de relancer. Pour accélérer la prochaine fois, colle le texte de l'énoncé avant de lancer l'analyse.";
