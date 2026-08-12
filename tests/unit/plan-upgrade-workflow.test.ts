/**
 * Tests du workflow « paywall & conversion » (aucun backend, aucun secret) :
 *
 *  1. Parcours GRATUIT : scan avec aperçu limité (document masqué côté
 *     serveur), nouvelles limites (4 scans / 3 fiches / 5 questions par
 *     quiz), bouton de déblocage → la donnée complète n'est JAMAIS envoyée.
 *  2. Parcours PAYANT (Student / Pro) : accès direct au document complet,
 *     quiz de 10 questions conservés, fiche complète.
 *  3. Paiement Stripe → webhook → déblocage automatique : dès que
 *     l'abonnement passe à « active », la même query renvoie le contenu
 *     complet sans autre action.
 *  4. Export PDF : marque StudySnap en pied de page, palette indigo/corail,
 *     structure multi-pages, contenu Markdown/LaTeX normalisé.
 */

import { describe, expect, test } from "bun:test";

import * as ai from "@/convex/ai";
import * as quizzes from "@/convex/quizzes";
import * as rateLimit from "@/convex/rateLimit";
import * as revisionSheets from "@/convex/revisionSheets";
import * as scans from "@/convex/scans";
import * as subscriptions from "@/convex/subscriptions";
import * as usage from "@/convex/usage";
import { buildPdf, encodePdfString, markdownToPlainText } from "@/lib/pdf";

import {
  call,
  makeDb,
  makeMutationCtx,
  makeQueryCtx,
  seedUsage,
  seedUser,
  setCurrentUser,
  uid,
  type MemoryDb,
} from "../helpers/mock-convex";

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

/** Analyse avec un document corrigé de 3 exercices (valide pour recordScan). */
function fullAnalysis() {
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Fonctions",
      level: "seconde",
      prompt: "Étudier la fonction f(x) = 2x + 3",
      data: "f(x) = 2x + 3",
      formulas: ["f(x) = ax + b"],
      legible: true,
    },
    quick: { answer: "x = 1", calculation: "2x = 2 → x = 1", keyPoint: "…" },
    explain: {
      question: "…",
      importantInfo: [],
      method: "…",
      steps: [],
      result: "…",
      commonMistake: "…",
    },
    revise: { lesson: "…", keyFormulas: [], exercises: [] },
    document: {
      title: "Correction complète — Fonctions affines",
      exercises: [
        { number: 1, question: "Q1", answer: "R1", calculation: "C1" },
        { number: 2, question: "Q2", answer: "R2", calculation: "C2" },
        { number: 3, question: "Q3", answer: "R3", calculation: "C3" },
      ],
    },
  };
}

function seedScanWithDocument(db: MemoryDb, owner: string, id = "scans-1") {
  db.seed("scans", [
    {
      _id: id,
      userId: owner,
      storageIds: [],
      subject: "Mathématiques",
      topic: "Fonctions",
      level: "seconde",
      title: "Fonctions affines",
      status: "done",
      mode: "quick",
      result: fullAnalysis(),
      createdAt: Date.now(),
    },
  ]);
}

function seedPaidPlan(db: MemoryDb, userId: string, plan: "student" | "pro") {
  db.seed("subscriptions", [
    {
      _id: "subscriptions-1",
      userId,
      plan,
      status: "active",
      stripeCustomerId: "cus_test_123",
      stripeSubscriptionId: "sub_test_123",
      periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: 1,
      updatedAt: 1,
    },
  ]);
}

/** Contexte d'ACTION simulé (comme dans les tests de rate limiting). */
function actionCtx(db: MemoryDb, plan: string) {
  const base = makeMutationCtx(db);
  return {
    ...base,
    runMutation: async (_fn: unknown, args: unknown) =>
      call(rateLimit.consume, makeMutationCtx(db), args),
    runQuery: async (_fn: unknown, args: unknown) =>
      (args as { userId?: string }).userId ? plan : null,
    scheduler: { runAfter: async () => undefined },
  };
}

/* ------------------------------------------------------------------ */
/* 1. Plan gratuit — aperçu limité + nouvelles limites                 */
/* ------------------------------------------------------------------ */

describe("Plan GRATUIT — paywall serveur et limites", () => {
  test("getScan ne renvoie qu'un APERÇU du document (1er exercice, reste masqué)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedScanWithDocument(db, uid(1));

    const res = await call<{
      result: {
        document: {
          locked: boolean;
          totalExercises: number;
          exercises: { answer: string }[];
        };
      };
    }>(scans.getScan, makeQueryCtx(db) as never, { scanId: "scans-1" } as never);

    expect(res).not.toBeNull();
    // Paywall : 1 exercice visible, les 2 autres jamais envoyés.
    expect(res!.result.document.locked).toBe(true);
    expect(res!.result.document.totalExercises).toBe(3);
    expect(res!.result.document.exercises).toHaveLength(1);
    // La réponse du 2e exercice n'est pas dans la réponse (masquée serveur).
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain("R2");
    expect(serialized).not.toContain("R3");
  });

  test("listMyScans retire le document complet pour un compte gratuit", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedScanWithDocument(db, uid(1));

    const res = await call<Array<{ result: { document?: unknown } }>>(
      scans.listMyScans,
      makeQueryCtx(db) as never,
      {},
    );
    expect(res).toHaveLength(1);
    // Le document complet n'est pas exposé dans la liste (ni la moindre réponse).
    expect(res[0].result.document).toBeUndefined();
  });

  test("4e scan gratuit autorisé, le 5e est bloqué (LIMIT_REACHED)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 3, lastScanAt: 0 });
    await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: [],
      analysis: fullAnalysis(),
      mode: "quick",
    } as never);
    expect(db.raw("scans")).toHaveLength(1);

    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4, lastScanAt: 0 });
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: [],
        analysis: fullAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "LIMIT_REACHED" } });
  });

  test("getMyUsage expose la nouvelle limite : 4 scans", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    const res = await call<{ limits: { scans: number } }>(
      usage.getMyUsage,
      makeQueryCtx(db) as never,
      {},
    );
    expect(res!.limits.scans).toBe(4);
  });

  test("quiz gratuit : 10 questions demandées → 5 questions stockées max", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1) });
    const questions = Array.from({ length: 10 }, (_, i) => ({
      type: "qcm" as const,
      question: `Question ${i + 1} ?`,
      options: ["A", "B", "C", "D"],
      answer: "A",
      explanation: "…",
    }));
    const id = await call(quizzes.saveQuiz, makeMutationCtx(db) as never, {
      subject: "Maths",
      level: "seconde",
      title: "Quiz",
      settings: { count: 10, difficulty: "easy", types: ["qcm"] },
      questions,
    } as never);
    const q = db.raw("quizzes").find((x) => x._id === id);
    expect(q!.questions).toHaveLength(5);
    expect((q!.settings as { count: number }).count).toBe(5);
  });

  test("generateQuiz plafonne à 5 questions pour un compte gratuit", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    const ctx = actionCtx(db, "free");
    const res = await call<{ questions: unknown[] }>(
      ai.generateQuiz,
      ctx as never,
      {
        subject: "Mathématiques",
        level: "seconde",
        count: 10,
        difficulty: "easy",
        types: ["qcm"],
      } as never,
    );
    expect(res.questions.length).toBe(5);
  });

  test("getSheet ne renvoie qu'un aperçu (concepts) + locked pour un gratuit", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    db.seed("revision_sheets", [
      {
        _id: "revision_sheets-1",
        userId: uid(1),
        title: "Fiche Fonctions",
        subject: "Maths",
        level: "seconde",
        sourceType: "text",
        storageIds: [],
        content: {
          concepts: [
            { term: "Fonction affine", definition: "f(x) = ax + b" },
            { term: "Coefficient directeur", definition: "a" },
            { term: "Ordonnée à l'origine", definition: "b" },
          ],
          formulas: [{ name: "Racine", formula: "x = -b/a" }],
          methods: ["Méthode secrète"],
          example: { question: "Q", solution: "S" },
          pitfalls: ["Piège"],
          takeaways: ["À retenir"],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const res = await call<{
      locked: boolean;
      content: { concepts: unknown[]; formulas: unknown[]; methods: string[] };
    }>(revisionSheets.getSheet, makeQueryCtx(db) as never, {
      sheetId: "revision_sheets-1",
    } as never);
    expect(res!.locked).toBe(true);
    // Aperçu : 2 concepts, tout le reste masqué.
    expect(res!.content.concepts).toHaveLength(2);
    expect(res!.content.formulas).toHaveLength(0);
    expect(res!.content.methods).toHaveLength(0);
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain("Méthode secrète");
    expect(serialized).not.toContain("À retenir");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Plan PAYANT — accès complet immédiat                             */
/* ------------------------------------------------------------------ */

describe("Plan PAYANT — accès complet sans étape de déblocage", () => {
  test("getScan renvoie le document COMPLET pour un abonné Student", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedPaidPlan(db, uid(1), "student");
    seedScanWithDocument(db, uid(1));

    const res = await call<{
      result: { document: { locked?: boolean; exercises: { answer: string }[] } };
    }>(scans.getScan, makeQueryCtx(db) as never, { scanId: "scans-1" } as never);
    expect(res!.result.document.locked).toBeUndefined();
    expect(res!.result.document.exercises).toHaveLength(3);
    expect(JSON.stringify(res)).toContain("R2");
    expect(JSON.stringify(res)).toContain("R3");
  });

  test("quiz payant : 10 questions demandées → 10 conservées", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedPaidPlan(db, uid(1), "student");
    const questions = Array.from({ length: 10 }, (_, i) => ({
      type: "qcm" as const,
      question: `Question ${i + 1} ?`,
      options: ["A", "B", "C", "D"],
      answer: "A",
      explanation: "…",
    }));
    const id = await call(quizzes.saveQuiz, makeMutationCtx(db) as never, {
      subject: "Maths",
      level: "seconde",
      title: "Quiz",
      settings: { count: 10, difficulty: "easy", types: ["qcm"] },
      questions,
    } as never);
    const q = db.raw("quizzes").find((x) => x._id === id);
    expect(q!.questions).toHaveLength(10);
  });

  test("generateQuiz conserve 10 questions pour un abonné", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    const ctx = actionCtx(db, "student");
    const res = await call<{ questions: unknown[] }>(
      ai.generateQuiz,
      ctx as never,
      {
        subject: "Mathématiques",
        level: "seconde",
        count: 10,
        difficulty: "easy",
        types: ["qcm"],
      } as never,
    );
    expect(res.questions.length).toBe(10);
  });

  test("getSheet renvoie la fiche COMPLÈTE pour un abonné Pro", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedPaidPlan(db, uid(1), "pro");
    db.seed("revision_sheets", [
      {
        _id: "revision_sheets-1",
        userId: uid(1),
        title: "Fiche Fonctions",
        subject: "Maths",
        level: "seconde",
        sourceType: "text",
        storageIds: [],
        content: {
          concepts: [{ term: "Fonction affine", definition: "f(x) = ax + b" }],
          formulas: [{ name: "Racine", formula: "x = -b/a" }],
          methods: ["Méthode complète"],
          example: { question: "Q", solution: "S" },
          pitfalls: ["Piège"],
          takeaways: ["À retenir"],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const res = await call<{ locked?: boolean; content: { methods: string[] } }>(
      revisionSheets.getSheet,
      makeQueryCtx(db) as never,
      { sheetId: "revision_sheets-1" } as never,
    );
    expect(res!.locked).toBeFalsy();
    expect(res!.content.methods).toEqual(["Méthode complète"]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Stripe → webhook → déblocage AUTOMATIQUE                         */
/* ------------------------------------------------------------------ */

describe("Stripe — paiement confirmé → déblocage automatique du compte", () => {
  test("checkout.session.completed → upsertSubscription active → accès complet immédiat", async () => {
    // État initial : compte gratuit avec un scan dont le document est masqué.
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedScanWithDocument(db, uid(1));

    const before = await call<{
      result: { document: { locked?: boolean } };
    }>(scans.getScan, makeQueryCtx(db) as never, { scanId: "scans-1" } as never);
    expect(before!.result.document.locked).toBe(true); // paywall actif

    // Le webhook Stripe appelle upsertSubscription avec status "active"
    // (c'est exactement ce que fait stripeWebhook → internal.subscriptions).
    await call(subscriptions.upsertSubscription, makeMutationCtx(db) as never, {
      userId: uid(1),
      plan: "student",
      status: "active",
      customerId: "cus_test_456",
      subscriptionId: "sub_test_456",
      periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
    } as never);

    // La même query renvoie désormais le document COMPLET — sans aucune
    // action manuelle (déblocage automatique).
    const after = await call<{
      result: { document: { locked?: boolean; exercises: unknown[] } };
    }>(scans.getScan, makeQueryCtx(db) as never, { scanId: "scans-1" } as never);
    expect(after!.result.document.locked).toBeUndefined();
    expect(after!.result.document.exercises).toHaveLength(3);
    expect(JSON.stringify(after)).toContain("R2");

    // Le plan renvoyé par getMyPlan est bien le plan payant.
    const plan = await call<{ plan: string }>(
      subscriptions.getMyPlan,
      makeQueryCtx(db) as never,
      {},
    );
    expect(plan!.plan).toBe("student");
  });

  test("la limite gratuite tombe dès que l'abonnement est actif (webhook)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4, lastScanAt: 0 });

    await call(subscriptions.upsertSubscription, makeMutationCtx(db) as never, {
      userId: uid(1),
      plan: "pro",
      status: "active",
    } as never);

    // 5e scan autorisé (un bot ne peut pas contourner en créant des comptes :
    // le paiement doit être confirmé côté Stripe pour obtenir le plan).
    const id = await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: [],
      analysis: fullAnalysis(),
      mode: "quick",
    } as never);
    expect(id).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Export PDF — marque, palette, structure                          */
/* ------------------------------------------------------------------ */

describe("Export PDF — document de marque StudySnap", () => {
  test("markdownToPlainText retire gras, LaTeX et liens", () => {
    const plain = markdownToPlainText(
      "**Réponse** : $x = \\dfrac{2}{4}$ et [lien](https://x.fr) et `code`.",
    );
    expect(plain).toContain("Réponse");
    expect(plain).toContain("(2)/(4)");
    expect(plain).not.toContain("**");
    expect(plain).not.toContain("https://");
    expect(plain).not.toContain("`");
  });

  test("buildPdf produit un PDF valide avec la marque StudySnap en pied de page", () => {
    const pdf = buildPdf({
      title: "Correction — Fonctions affines",
      subtitle: "Mathématiques · Seconde",
      blocks: [
        { type: "h1", text: "Correction complète" },
        { type: "h2", text: "Exercice 1" },
        { type: "text", text: "Question : Résoudre 2x + 3 = 7" },
        { type: "text", text: "Réponse : x = 2" },
        { type: "divider" },
      ],
    });
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    // Le bandeau contient le titre (le tiret cadratin est encodé WinAnsi).
    expect(pdf).toContain("Correction");
    expect(pdf).toContain("Fonctions affines");
    expect(pdf).toContain("StudySnap"); // marque
    expect(pdf).toContain("Ton devoir. Ton IA. Ta méthode."); // tagline
    expect(pdf).toContain("Page 1 / 1"); // pagination
    // Palette : indigo et corail présents dans les opérateurs de dessin.
    expect(pdf).toContain("0.310 0.275 0.898"); // #4F46E5 indigo
    expect(pdf).toContain("1.000 0.420 0.290"); // #FF6B4A corail
  });

  test("le pied de page apparaît sur CHAQUE page d'un document multi-pages", () => {
    const longLine =
      "Un paragraphe assez long pour forcer plusieurs retours à la ligne dans une largeur A4, avec des mots nombreux et variés pour occuper l'espace disponible et dépasser la hauteur d'une page.";
    const blocks = Array.from({ length: 40 }, () => ({
      type: "text" as const,
      text: longLine,
    }));
    const pdf = buildPdf({ title: "Long document", blocks });
    const footerCount = pdf.split("Ton devoir. Ton IA. Ta méthode.").length - 1;
    expect(footerCount).toBeGreaterThan(1); // au moins 2 pages
    expect(pdf).toContain(`Page 1 / ${footerCount}`);
    expect(pdf).toContain(`Page ${footerCount} / ${footerCount}`);
  });

  test("encodePdfString échappe parenthèses et barres obliques", () => {
    expect(encodePdfString("a(b)c\\d")).toBe("a\\(b\\)c\\\\d");
    expect(encodePdfString("é à ç")).toBe("é à ç"); // Latin-1 conservé
    expect(encodePdfString("œ")).toBe("\x9c"); // WinAnsi 0x9C
  });
});
