/**
 * StudySnap — générateur de PDF de marque (aucune dépendance).
 *
 * Produit un PDF A4 multi-pages avec :
 *  - bandeau d'en-tête en dégradé indigo #4F46E5 → corail #FF6B4A (l'identité
 *    visuelle de l'app) avec le titre du document ;
 *  - pied de page sur CHAQUE page : marque « StudySnap — Ton devoir. Ton IA.
 *    Ta méthode. » + numéro de page ;
 *  - mise en page soignée : titres, sections, listes à puces, séparateurs,
 *    retours à la ligne automatiques.
 *
 * Le PDF utilise les polices standards PDF (Helvetica) avec l'encodage
 * WinAnsi : aucun fichier de police à embarquer. Les caractères hors
 * WinAnsi (œ, …, √, fractions LaTeX…) sont normalisés en texte lisible.
 *
 * Fonctions pures (testables dans bun, aucun DOM requis) + un helper
 * navigateur pour déclencher le téléchargement.
 */

export type PdfBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "text"; text: string }
  | { type: "bullet"; text: string }
  | { type: "divider" }
  | { type: "spacer"; size?: number };

export interface PdfDocument {
  /** Titre du document (bandeau d'en-tête de chaque page). */
  title: string;
  /** Sous-titre affiché sous le titre (première page) — ex. matière · niveau. */
  subtitle?: string;
  blocks: PdfBlock[];
}

/* ------------------------------------------------------------------ */
/* Couleurs de la marque                                               */
/* ------------------------------------------------------------------ */

const INDIGO: [number, number, number] = [0x4f, 0x46, 0xe5];
const CORAL: [number, number, number] = [0xff, 0x6b, 0x4a];
const DARK: [number, number, number] = [0x1f, 0x29, 0x37];
const GRAY: [number, number, number] = [0x6b, 0x72, 0x80];
const FAINT: [number, number, number] = [0xe5, 0xe7, 0xeb];

const rgb = (c: [number, number, number]) =>
  `${(c[0] / 255).toFixed(3)} ${(c[1] / 255).toFixed(3)} ${(c[2] / 255).toFixed(3)}`;

/* ------------------------------------------------------------------ */
/* Encodage WinAnsi (Latin-1 + quelques caractères)                    */
/* ------------------------------------------------------------------ */

/** Caractères Unicode hors Latin-1 présents dans WinAnsi (0x80-0x9F). */
const WIN_ANSI_EXTRA: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

/** Caractères Unicode → substitut lisible (hors WinAnsi). */
const SUBSTITUTES: Record<string, string> = {
  "√": "√(",
  "Δ": "Delta",
  "ℝ": "R",
  "ℕ": "N",
  "∞": "infini",
  "→": "→ ",
  "≤": "<=",
  "≥": ">=",
  "≠": "≠",
  "±": "±",
  "×": "×",
  "÷": "÷",
  "⋅": "·",
  "⇒": "=>",
  "⇔": "<=>",
  "∈": "appartient à ",
};

/** Échappe et encode une chaîne pour une chaîne PDF (parenthèses incluses). */
export function encodePdfString(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\" || ch === "(" || ch === ")") {
      out += `\\${ch}`;
      continue;
    }
    if (code >= 0x20 && code <= 0x7e) {
      out += ch;
      continue;
    }
    const extra = WIN_ANSI_EXTRA[ch];
    if (extra !== undefined) {
      out += String.fromCharCode(extra);
      continue;
    }
    if (code >= 0xa0 && code <= 0xff) {
      out += ch; // Latin-1 = WinAnsi sur cette plage
      continue;
    }
    const sub = SUBSTITUTES[ch];
    out += sub ?? "?";
  }
  return out;
}

/** Largeur approximative d'un texte en points (Helvetica, facteur 1000). */
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c === 0x20) w += 278;
    else if (c >= 0x41 && c <= 0x5a) w += 611; // majuscules
    else if (c >= 0x61 && c <= 0x7a) w += 500; // minuscules
    else if (c >= 0x30 && c <= 0x39) w += 556; // chiffres
    else w += 500;
  }
  return (w / 1000) * size;
}

/** Découpe un texte en lignes qui tiennent dans la largeur donnée. */
function wrapText(text: string, size: number, maxWidth: number): string[] {
  const paragraphs = text.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (textWidth(candidate, size) <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Markdown → texte brut (export PDF)                                  */
/* ------------------------------------------------------------------ */

/** Conversions LaTeX → texte lisible (fractions, racines, symboles). */
function latexToPlainText(text: string): string {
  return text
    .replace(/\\dfrac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^}]*)\}/g, "√($1)")
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\pm/g, "±")
    .replace(/\\leq|\\le/g, "<=")
    .replace(/\\geq|\\ge/g, ">=")
    .replace(/\\neq/g, "≠")
    .replace(/\\infty/g, "infini")
    .replace(/\\to/g, "→")
    .replace(/\^\{?2\}?/g, "²")
    .replace(/\^\{?3\}?/g, "³")
    .replace(/\^\{?([^{}]+)\}?/g, "^($1)")
    .replace(/\{([^}]*)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, "");
}

/**
 * Convertit un contenu Markdown (tels que produits par l'IA) en texte
 * brut lisible pour le PDF : retire les étoiles, backticks, titres,
 * liens et formules LaTeX.
 */
export function markdownToPlainText(input: string): string {
  const s = (input ?? "").trim();
  if (!s) return "";
  // Formules LaTeX (inline et bloc) → texte lisible.
  const noLatex = s
    .replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner: string) => ` ${latexToPlainText(inner)} `)
    .replace(/\$([^$\n]+?)\$/g, (_m, inner: string) => ` ${latexToPlainText(inner)} `);
  return noLatex
    .replace(/`([^`]*)`/g, "$1") // code inline
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens
    .replace(/^#{1,6}\s+/gm, "") // titres
    .replace(/^\s*[-*+]\s+/gm, "•  ") // listes
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // gras
    .replace(/(\*|_)([^*_]*)\1/g, "$2") // italique
    .replace(/~~(.*?)~~/g, "$1") // barré
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Construction du PDF                                                 */
/* ------------------------------------------------------------------ */

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 46;
const HEADER_H = 62;
const FOOTER_GAP = 64; // zone réservée en bas de page
const BODY_MAX_W = PAGE_W - MARGIN * 2;
const GRADIENT_STEPS = 28;

/** Interpole deux couleurs RGB. */
function lerp(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ] as [number, number, number];
}

/** Opérateurs de dessin de l'en-tête (bandeau dégradé + titre). */
function headerOps(title: string): string {
  const ops: string[] = [];
  // Dégradé indigo → corail : bandes verticales successives.
  const stepW = PAGE_W / GRADIENT_STEPS;
  for (let i = 0; i < GRADIENT_STEPS; i++) {
    const color = lerp(INDIGO, CORAL, i / (GRADIENT_STEPS - 1));
    const x = (i * stepW).toFixed(2);
    ops.push(
      `q ${rgb(color)} rg ${x} 0 ${(stepW + 0.5).toFixed(2)} ${HEADER_H} re f Q`,
    );
  }
  // Liseré corail en bas du bandeau.
  ops.push(`q ${rgb(CORAL)} rg 0 ${HEADER_H - 2.5} ${PAGE_W} 2.5 re f Q`);
  // Titre en blanc, tronqué à la largeur disponible.
  const size = 17;
  const maxW = PAGE_W - MARGIN * 2;
  let t = title;
  while (textWidth(t, size) > maxW && t.length > 4) t = `${t.slice(0, -4)}…`;
  ops.push(
    `BT /F2 ${size} Tf ${rgb([255, 255, 255])} rg ${MARGIN} ${
      HEADER_H - 26
    } Td (${encodePdfString(t)}) Tj ET`,
  );
  return ops.join("\n");
}

/** Opérateurs du pied de page (marque StudySnap + page X/Y). */
function footerOps(page: number, total: number): string {
  const yLine = PAGE_H - 48;
  const yText = PAGE_H - 40;
  const brand = `StudySnap — Ton devoir. Ton IA. Ta méthode.`;
  const pageText = `Page ${page} / ${total}`;
  const ops: string[] = [];
  // Séparateur discret.
  ops.push(`q ${rgb(FAINT)} rg ${MARGIN} ${yLine} ${PAGE_W - MARGIN * 2} 1 re f Q`);
  // Marque : « StudySnap » en indigo gras + tagline en gris.
  ops.push(
    `BT /F2 7.5 Tf ${rgb(INDIGO)} rg ${MARGIN} ${yText} Td (StudySnap) Tj ET`,
  );
  ops.push(
    `BT /F1 7.5 Tf ${rgb(GRAY)} rg ${(MARGIN + textWidth("StudySnap", 7.5) + 3).toFixed(2)} ${yText} Td (${encodePdfString(
      brand.slice("StudySnap".length),
    )}) Tj ET`,
  );
  // Numéro de page à droite.
  const pageW = textWidth(pageText, 7.5);
  ops.push(
    `BT /F1 7.5 Tf ${rgb(GRAY)} rg ${(PAGE_W - MARGIN - pageW).toFixed(2)} ${yText} Td (${pageText}) Tj ET`,
  );
  return ops.join("\n");
}

interface BuiltPage {
  content: string;
}

/**
 * Construit le PDF complet à partir des blocs. Retourne les octets PDF
 * (string binaire) prêts à être téléchargés.
 */
export function buildPdf(doc: PdfDocument): string {
  const title = (doc.title || "StudySnap").trim();
  const pages: BuiltPage[] = [];
  let y = HEADER_H + 18;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - FOOTER_GAP - 8) {
      pages.push({ content: headerOps(title) });
      y = HEADER_H + 18;
    }
  };

  const startOps = (): string[] => {
    if (pages.length === 0) pages.push({ content: headerOps(title) });
    return [];
  };
  // Accumulateur d'opérateurs de la page courante (pages[dernière].content).
  const append = (op: string) => {
    if (pages.length === 0) startOps();
    pages[pages.length - 1].content += `\n${op}`;
  };

  const drawText = (text: string, size: number, font: "F1" | "F2" | "F3", color: [number, number, number], leading: number, indent = 0, bullet = "") => {
    const lines = wrapText(text, size, BODY_MAX_W - indent - textWidth(bullet, size));
    const lineH = leading;
    const height = lines.length * lineH;
    ensureSpace(Math.min(height, 400));
    const x = MARGIN + indent;
    let cursor = y;
    for (const line of lines) {
      const prefix = bullet ? (line === lines[0] ? `${bullet}  ` : "   ") : "";
      append(
        `BT /${font} ${size} Tf ${rgb(color)} rg ${x.toFixed(2)} ${cursor.toFixed(2)} Td (${encodePdfString(
          `${prefix}${line}`,
        )}) Tj ET`,
      );
      cursor += lineH;
    }
    y = cursor;
  };

  // Sous-titre (première page, sous le bandeau).
  if (doc.subtitle) {
    drawText(doc.subtitle, 9.5, "F3", GRAY, 14);
    y += 2;
    append(`q ${rgb(FAINT)} rg ${MARGIN} ${(y - 6).toFixed(2)} ${BODY_MAX_W} 0.75 re f Q`);
    y += 8;
  }

  for (const block of doc.blocks) {
    switch (block.type) {
      case "spacer":
        ensureSpace(block.size ?? 10);
        y += block.size ?? 10;
        break;
      case "divider": {
        ensureSpace(14);
        y += 4;
        append(`q ${rgb(CORAL)} rg ${MARGIN} ${(y - 1.5).toFixed(2)} ${BODY_MAX_W} 1.5 re f Q`);
        y += 12;
        break;
      }
      case "h1": {
        ensureSpace(30);
        y += 8;
        drawText(block.text, 18, "F2", INDIGO, 24);
        y += 6;
        break;
      }
      case "h2": {
        ensureSpace(24);
        y += 6;
        drawText(block.text, 12.5, "F2", INDIGO, 17);
        y += 3;
        break;
      }
      case "text": {
        drawText(block.text, 10, "F1", DARK, 15);
        y += 6;
        break;
      }
      case "bullet": {
        drawText(block.text, 10, "F1", DARK, 15, 10, "•");
        y += 5;
        break;
      }
    }
  }

  const total = pages.length;

  // Assemble le fichier PDF avec une numérotation d'objets CONTIGUË :
  //   1 catalogue · 2 pages · (3 libre) · 4/5/6 polices · puis par page :
  //   contenu, pied de page, objet Page.
  const objects = new Map<number, string>();
  const setObject = (n: number, body: string) =>
    objects.set(n, `${n} 0 obj\n${body}\nendobj`);
  const stream = (data: string) =>
    `<< /Length ${new TextEncoder().encode(data).length} >>\nstream\n${data}\nendstream`;

  const F1 = 4;
  const F2 = 5;
  const F3 = 6;
  let next = 7;
  const pageObjectIds: number[] = [];
  for (let i = 0; i < total; i++) {
    const contentId = next++;
    const footerId = next++;
    const pageId = next++;
    setObject(contentId, stream(pages[i].content));
    setObject(footerId, stream(footerOps(i + 1, total)));
    setObject(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${F1} 0 R /F2 ${F2} 0 R /F3 ${F3} 0 R >> >> /Contents [${contentId} 0 R ${footerId} 0 R] >>`,
    );
    pageObjectIds.push(pageId);
  }

  setObject(F1, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  setObject(F2, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);
  setObject(F3, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>`);

  setObject(2, `<< /Type /Pages /Kids [${pageObjectIds.map((n) => `${n} 0 R`).join(" ")}] /Count ${total} >>`);
  setObject(1, `<< /Type /Catalog /Pages 2 0 R >>`);

  const maxObj = Math.max(...objects.keys());
  let out = "%PDF-1.4\n";
  const offsets = new Map<number, number>();
  for (let i = 1; i <= maxObj; i++) {
    if (!objects.has(i)) continue;
    offsets.set(i, out.length);
    out += objects.get(i) + "\n";
  }
  const xrefPos = out.length;
  const size = maxObj + 1;
  out += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let i = 1; i < size; i++) {
    if (!objects.has(i)) {
      out += "0000000000 65535 f \n"; // entrée libre pour les numéros inutilisés
      continue;
    }
    out += `${String(offsets.get(i)).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers navigateur                                                  */
/* ------------------------------------------------------------------ */

/**
 * Déclenche le téléchargement du PDF dans le navigateur.
 * Retourne true si le téléchargement a été lancé.
 */
export function downloadPdf(pdfBytes: string, filename: string): boolean {
  if (typeof document === "undefined") return false;
  const bytes = new Uint8Array(pdfBytes.length);
  for (let i = 0; i < pdfBytes.length; i++) {
    bytes[i] = pdfBytes.charCodeAt(i) & 0xff;
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}
