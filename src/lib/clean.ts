/**
 * Nettoyage des contenus générés par l'IA : le modèle peut renvoyer des
 * artefacts HTML/CSS (ex: <div>, <span>, ou "div5") au milieu d'un énoncé,
 * d'une définition ou d'une formule. On les retire ici pour qu'aucune balise
 * ou artefact de code ne soit jamais visible côté utilisateur — sans casser
 * les comparaisons mathématiques ("x < 5" n'est pas touché).
 */

/** Balises HTML connues (avec attributs éventuels) : supprimées entièrement. */
const HTML_TAG_RE =
  /<\/?(?:div|span|p|br|b|i|u|em|strong|li|ul|ol|table|tr|td|th|h[1-6]|a|img|section|article|sup|sub|small|big|font|center|blockquote|code|pre|style|script|form|label|button|textarea|select|option)\b[^>]*>/gi;

/** Artefacts du type "div5" (nom de balise + chiffres, ex: <div5>). */
const HTML_ARTIFACT_RE = /<\/?[a-z]+\d+>/gi;

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

/** Retire les artefacts HTML/CSS et décode les entités courantes. */
export function stripHtmlArtifacts(text: string): string {
  return (text ?? "")
    .replace(HTML_TAG_RE, "")
    .replace(HTML_ARTIFACT_RE, "")
    .replace(/&(nbsp|amp|lt|gt|quot|#39|apos);/gi, (m) => {
      return ENTITIES[m.toLowerCase()] ?? m;
    });
}

/**
 * Assainit le texte fourni par l'utilisateur avant de l'injecter dans un
 * prompt IA (défense contre l'injection de prompt) : suppression des
 * caractères de contrôle, normalisation des retours à la ligne, longueur
 * plafonnée. Le contenu est toujours traité comme une donnée, jamais comme
 * une instruction.
 */
export function sanitizeUserText(text: string, maxLength = 8000): string {
  return (text ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
}
