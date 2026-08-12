/**
 * Tests unitaires — 2 changements produits :
 *
 * 1. Scanner SANS caméra : la prise de photo directe a été retirée, seule
 *    l'import depuis la galerie/le stockage reste. Aucune demande de
 *    permission caméra (getUserMedia / CameraCapture / « Prendre une photo »)
 *    ne doit subsister nulle part dans l'app.
 *
 * 2. Quiz basé sur un devoir / contrôle / leçon : le créateur de quiz propose
 *    un choix clair (standard vs document), l'import galerie alimente le
 *    pipeline OCR existant (AI_MODEL_FAST) puis la génération (AI_MODEL), et
 *    un avertissement de durée est affiché avant le lancement.
 *
 * Tests au niveau source (comme le reste de la suite) : aucune clé, aucun
 * backend, fixtures locales uniquement.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const SRC = join(ROOT, "src");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. Scanner sans caméra                                              */
/* ------------------------------------------------------------------ */

describe("Scanner — prise de photo directe retirée", () => {
  const scanner = read("pages/Scanner.tsx");

  test("le composant viewfinder CameraCapture n'est plus importé", () => {
    expect(scanner).not.toContain("CameraCapture");
  });

  test("plus aucun état ni handler caméra (cameraOpen / cameraError / openCamera)", () => {
    expect(scanner).not.toContain("cameraOpen");
    expect(scanner).not.toContain("cameraError");
    expect(scanner).not.toContain("openCamera");
  });

  test("plus aucun bouton « Prendre une photo »", () => {
    expect(scanner).not.toContain("Prendre une photo");
    expect(scanner).not.toContain("Ouvre la caméra");
  });

  test("le sélecteur de fichiers est présenté directement (galerie / fichier)", () => {
    expect(scanner).toContain("Importer depuis la galerie");
    expect(scanner).toContain("Choisir un fichier");
    expect(scanner).toContain('type="file"');
  });

  test("aucune demande de permission caméra ne subsiste dans toute l'app", () => {
    const tsFiles: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, f.name);
        if (f.isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(f.name) && !p.includes("_generated")) tsFiles.push(p);
      }
    };
    walk(SRC);
    const src = tsFiles
      .map((p) => readFileSync(p, "utf8"))
      .join("\n")
      // Le hook use-device détecte la capacité média (« mediaDevices » in
      // navigator) — une simple vérification de présence, jamais un appel.
      .replace(/["']mediaDevices["'] in navigator/g, "");
    expect(src).not.toContain("getUserMedia");
    expect(src).not.toMatch(/CameraCapture/);
    expect(src).not.toContain("Prendre une photo");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Quiz basé sur un document (devoir / contrôle / leçon)            */
/* ------------------------------------------------------------------ */

describe("Quiz basé sur un document — backend (convex/ai.ts)", () => {
  const ai = read("convex/ai.ts");

  test("generateQuiz accepte des photos (storageIds + contentTypes)", () => {
    const quizSection = ai.slice(ai.indexOf("export const generateQuiz"));
    expect(quizSection).toMatch(/storageIds: v\.optional\(v\.array\(v\.string\(\)\)\)/);
    expect(quizSection).toMatch(/contentTypes: v\.optional\(v\.array\(v\.string\(\)\)\)/);
  });

  test("le prompt documentaire existe et impose des questions issues du document", () => {
    expect(ai).toContain("QUIZ_DOCUMENT_SYSTEM_PROMPT");
    const prompt = ai.slice(
      ai.indexOf("const QUIZ_DOCUMENT_SYSTEM_PROMPT"),
      ai.indexOf("export const generateQuiz"),
    );
    // Les questions reprennent UNIQUEMENT le contenu du document fourni,
    // jamais des questions génériques sur la matière.
    expect(prompt).toMatch(/reprendre UNIQUEMENT les notions/);
    expect(prompt).toMatch(/jamais des questions génériques sur la matière/);
    expect(prompt).toMatch(/Ne JAMAIS inventer une donnée absente du document/);
    // La matière est détectée depuis le document (champ subject de la réponse).
    expect(prompt).toMatch(/"subject"/);
  });

  test("le pipeline OCR existant est réutilisé (AI_MODEL_FAST puis AI_MODEL)", () => {
    const quizSection = ai.slice(ai.indexOf("export const generateQuiz"));
    // Étape 1 : lecture du document avec le modèle rapide (même helper que
    // l'OCR du Scanner — pas de logique dupliquée).
    expect(quizSection).toContain("ocrImageText(imageParts");
    expect(quizSection).toMatch(/aiFastModelConfigured\(\)/);
    // Étape 2 : le quiz est généré à partir du texte extrait (modèle
    // principal) avec un repli vision si l'OCR échoue.
    expect(quizSection).toMatch(/content\.push\(\.\.\.imageParts\)/);
  });

  test("le retour inclut la matière détectée (champ subject)", () => {
    const quizSection = ai.slice(ai.indexOf("export const generateQuiz"));
    expect(quizSection).toMatch(/subject: isDocumentQuiz/);
  });
});

describe("Quiz basé sur un document — frontend (pages/Revision.tsx)", () => {
  const revision = read("pages/Revision.tsx");

  test("un choix clair est proposé : standard vs sur un devoir / contrôle / leçon", () => {
    expect(revision).toContain("Quiz standard");
    expect(revision).toContain("Sur un devoir / contrôle / leçon");
    expect(revision).toContain('setSource("standard")');
    expect(revision).toContain('setSource("document")');
  });

  test("l'import galerie alimente la génération (storageIds envoyés à generateQuiz)", () => {
    expect(revision).toContain("Importer depuis la galerie");
    expect(revision).toContain("downscaleImage(f.file)");
    expect(revision).toMatch(/storageIds: source === "document" \? storageIds : undefined/);
    expect(revision).toMatch(/contentTypes: source === "document" \? contentTypes : undefined/);
  });

  test("l'avertissement de durée est affiché avant le lancement", () => {
    expect(revision).toContain(
      "Cette génération peut prendre plus de temps que d'habitude",
    );
    // « le » est en début de ligne suivante dans la source JSX : on vérifie
    // la fin de la phrase sans dépendre du retour à la ligne.
    expect(revision).toContain("temps d'analyser le contenu en détail");
  });

  test("des étapes de chargement dédiées au mode document existent", () => {
    expect(revision).toContain("QUIZ_STEPS_DOCUMENT");
    expect(revision).toContain("Lecture de la photo du devoir…");
    expect(revision).toContain("Analyse détaillée du contenu…");
  });

  test("aucune caméra dans le créateur de quiz (import galerie uniquement)", () => {
    expect(revision).not.toContain("CameraCapture");
    expect(revision).not.toContain("getUserMedia");
    expect(revision).not.toContain("Prendre une photo");
  });
});
