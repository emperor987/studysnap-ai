/**
 * Tests unitaires — classification des documents analysés (exercice vs long
 * vs fiche/cours complet) et condensation du texte OCR. Ces helpers pilotent
 * le prompt dédié aux fiches denses : une mauvaise classification ferait
 * exploser la complexité (et la latence) de la génération.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  condenseLongText,
  documentKind,
  isLongExercise,
} from "@/lib/analysis";

const ROOT = resolve(import.meta.dir, "..", "..");

describe("documentKind — classification du document scanné", () => {
  test("exercice court et ciblé → 'exercise'", () => {
    expect(documentKind("Résoudre dans R l'équation 2x + 3 = 7.")).toBe("exercise");
    expect(documentKind("Calculer l'aire d'un triangle de base 4 et de hauteur 3.")).toBe("exercise");
  });

  test("énoncé avec ≥ 4 sous-questions → 'long'", () => {
    const ex = [
      "On considère la fonction f définie sur R par f(x) = x² − 4x + 3.",
      "1) Développer l'expression de f(x).",
      "2) Factoriser f(x).",
      "3) Résoudre l'équation f(x) = 0.",
      "4) Tracer la courbe représentative de f.",
    ].join("\n");
    expect(documentKind(ex)).toBe("long");
  });

  test("fiche de révision structurée → 'fiche'", () => {
    const fiche = [
      "Chapitre 4 — Les fonctions",
      "1. Définition : une fonction f associe à tout x un unique f(x).",
      "2. Théorème : f est croissante si a > 0.",
      "3. Propriété : le signe de a donne le sens de variation.",
      "4. Méthode : pour étudier une fonction affine, on calcule le coefficient directeur.",
      "5. Exemple : f(x) = 2x - 3, f est croissante.",
    ].join("\n");
    expect(documentKind(fiche)).toBe("fiche");
  });

  test("texte très long (> 2500 caractères) → 'fiche'", () => {
    const long = ("Paragraphe de cours. ".repeat(200)).trim(); // ~4400 caractères
    expect(long.length).toBeGreaterThan(2500);
    expect(documentKind(long)).toBe("fiche");
  });

  test("isLongExercise reste compatible (texte > 900 caractères)", () => {
    expect(isLongExercise("a".repeat(950))).toBe(true);
    expect(isLongExercise("Résoudre x + 1 = 2.")).toBe(false);
  });
});

describe("condenseLongText — garde début + fin, tronque le milieu", () => {
  test("texte court → inchangé", () => {
    const t = "Un court énoncé.";
    expect(condenseLongText(t, 50, 20)).toBe(t);
  });

  test("texte long → début + marqueur + fin", () => {
    const t = "A".repeat(200) + "X".repeat(500) + "Z".repeat(100);
    const out = condenseLongText(t, 100, 50);
    expect(out).toContain("section intermédiaire tronquée");
    expect(out.startsWith("A".repeat(100))).toBe(true);
    expect(out.endsWith("Z".repeat(50))).toBe(true);
    // Le milieu (les X) a été retiré.
    expect(out).not.toContain("X");
  });
});

describe("Le pipeline IA utilise bien la classification fiche", () => {
  const ai = readFileSync(join(ROOT, "src/convex/ai.ts"), "utf8");

  test("ai.ts importe documentKind et condenseLongText", () => {
    expect(ai).toContain("documentKind");
    expect(ai).toContain("condenseLongText");
  });

  test("un prompt dédié aux fiches denses existe et est branché sur analyzeText", () => {
    expect(ai).toContain("SYSTEM_PROMPT_DENSE");
    expect(ai).toContain("isFiche ? SYSTEM_PROMPT_DENSE : SYSTEM_PROMPT");
  });

  test("le plafond OCR est optimisé pour la vitesse (≤ 2048 tokens)", () => {
    expect(ai).toMatch(/maxTokens: 2048/);
  });
});
