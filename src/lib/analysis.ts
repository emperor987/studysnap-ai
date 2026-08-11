/**
 * Détection du « type de document » à partir du texte extrait par l'OCR :
 *  - « exercise » : un exercice court et ciblé (cas nominal, analyse rapide) ;
 *  - « long » : un énoncé long/problème qui demande plus de temps à l'IA
 *    (plusieurs sous-questions, rédaction, démonstration…) ;
 *  - « fiche » : un cours / une fiche / une feuille de révision entière
 *    (plusieurs notions, sections structurées). Ce cas est le plus coûteux :
 *    le pipeline utilise alors un prompt dédié qui demande une réponse
 *    CONCISE, et condense le texte envoyé au modèle.
 */

// NB : pas de \b (il est ASCII-only en JS : il échouerait sur les mots qui
// se terminent par une lettre accentuée, ex: « propriété »). On utilise des
// lookarounds qui couvrent aussi les lettres accentuées.
const WORD_CHAR = /[A-Za-zÀ-ÿ0-9]/;

const COURSE_SECTION_RE =
  /^(?:\d{1,2}[.)]\s*|[-•*]\s*|i{1,3}\.\s*|iv\.\s*)?(chapitre|cours|leçon|lecon|fiche|définition|definition|théorème|theoreme|propriété|propriete|remarque|règle|regle|méthode|methode|exemple|exercice|partie)(?![A-Za-zÀ-ÿ0-9])/i;

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

export type DocumentKind = "exercise" | "long" | "fiche";

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

/**
 * Classifie le texte OCR du document. La classification « fiche » déclenche
 * côté serveur un prompt dédié (réponse concise) et une condensation du texte.
 */
export function documentKind(text: string): DocumentKind {
  const t = (text ?? "").trim();
  if (t.length < 60) return "exercise";

  const lines = t
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1) Document très long → très probablement un cours/fiche entier.
  if (t.length > 2500) return "fiche";

  // 2) Sections de cours explicites (chapitre, définition, théorème…).
  //    Vérifié AVANT les items numérotés : une fiche numérote souvent ses
  //    sections (« 1. Définition », « 2. Théorème »…).
  const sectionHits = lines.filter((l) => {
    // Frontière de mot manuelle : ni \b (ASCII-only) ni lettre accentuée.
    const m = l.match(COURSE_SECTION_RE);
    if (!m) return false;
    const before = l[m.index! - 1];
    return !before || !WORD_CHAR.test(before);
  }).length;
  if (sectionHits >= 3 && t.length > 200) return "fiche";

  // 3) Beaucoup d'items numérotés + texte fourni → feuille de révision.
  const numberedItems = (t.match(/\b\d{1,2}\s*[.)]\s/g) || []).length;
  if (numberedItems >= 8 && t.length > 600) return "fiche";
  if (numberedItems >= 4) return "long";

  // 4) Sinon : énoncé long (sous-questions, rédaction…) ou exercice simple.
  return isLongExercise(t) ? "long" : "exercise";
}

/** Message d'avertissement affiché pendant l'analyse d'un exercice long. */
export const LONG_ANALYSIS_WARNING =
  "Ce type d'exercice (énoncé long ou problème) demande plus de travail à l'IA : l'analyse peut prendre 1 à 2 minutes. Elle est en cours — pas besoin de relancer. Pour accélérer la prochaine fois, colle le texte de l'énoncé avant de lancer l'analyse.";

/** Message d'avertissement pendant l'analyse d'une fiche / d'un cours complet. */
export const FICHE_ANALYSIS_WARNING =
  "Fiche ou cours complet détecté : l'IA synthétise les notions principales et reste concise, mais l'analyse peut prendre 1 à 2 minutes. Pour accélérer, colle le texte ou scanne une seule notion à la fois.";

/**
 * Condense un long texte OCR avant de l'envoyer au modèle : on garde le
 * début (où se trouvent généralement l'énoncé/le titre) et la fin (formules,
 * conclusion), avec un marqueur neutre au milieu. Évite de noyer le modèle
 * dans des milliers de caractères — la génération est plus rapide et plus
 * fiable, sans perdre les extrémités du document.
 */
export function condenseLongText(
  text: string,
  headChars = 4000,
  tailChars = 1500,
): string {
  const t = (text ?? "").trim();
  if (t.length <= headChars + tailChars + 40) return t;
  const head = t.slice(0, headChars).trimEnd();
  const tail = t.slice(t.length - tailChars).trimStart();
  return `${head}\n\n[--- section intermédiaire tronquée ---]\n\n${tail}`;
}
