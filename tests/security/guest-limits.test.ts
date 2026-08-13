/**
 * Tests de sécurité — Mode invité (démo, sans compte) :
 *
 * Un invité est un utilisateur Anonymous de Convex Auth (users.isAnonymous).
 * Les limites suivantes doivent être appliquées CÔTÉ SERVEUR (aucun contournement
 * possible en appelant les mutations/actions directement) :
 *
 *  - 1 seul scan autorisé (recordScan, actions IA ocrPhotos/analyzeText, et la
 *    démo createDemoScan est totalement bloquée — elle contournerait le compteur) ;
 *  - fiches de révision et quiz réservés aux comptes (mutations ET actions IA) ;
 *  - historique et progression masqués (listMyScans, listMySheets, listMyQuizzes,
 *    getQuiz, getMyStats) ;
 *  - le résultat du scan unique reste consultable (getScan) ;
 *  - aucune donnée persistée : wipeMyGuestData à la déconnexion + purge des
 *    sessions abandonnées par cleanupGuestAccounts ;
 *  - les comptes classiques (gratuits) ne sont PAS touchés par ces limites.
 *
 * Aucun backend déployé : contexte simulé + handlers Convex appelés directement.
 * Aucune clé tierce requise.
 */
import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";

import * as ai from "@/convex/ai";
import * as guest from "@/convex/guest";
import * as quizzes from "@/convex/quizzes";
import * as revisionSheets from "@/convex/revisionSheets";
import * as scans from "@/convex/scans";
import * as usageMod from "@/convex/usage";

import {
  call,
  makeDb,
  makeMutationCtx,
  mockStorage,
  seedUsage,
  seedUser,
  setCurrentUser,
  uid,
  type MemoryDb,
} from "../helpers/mock-convex";

const GUEST_ID = uid(999);
const NORMAL_ID = uid(1);

/** Analyse minimale valide pour recordScan (le client envoie ceci). */
function validAnalysis() {
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Équations",
      level: "seconde",
      prompt: "Résoudre x² = 9",
      data: "x² = 9",
      formulas: [],
      legible: true,
    },
    quick: { answer: "x = 3 ou x = -3", calculation: "√9 = 3", keyPoint: "Deux solutions." },
    explain: {
      question: "Résoudre x² = 9",
      importantInfo: [],
      method: "Racine carrée",
      steps: ["Isoler x²", "Prendre la racine"],
      result: "x = ±3",
      commonMistake: "Oublier la solution négative.",
    },
    revise: { lesson: "Équation du second degré", keyFormulas: [], exercises: [] },
    document: { title: "Correction", exercises: [] },
  };
}

function seedGuestUser(db: MemoryDb, extra: Record<string, unknown> = {}) {
  seedUser(db, GUEST_ID, { isAnonymous: true, ...extra });
}

function seedNormalUser(db: MemoryDb) {
  seedUser(db, NORMAL_ID, { isAnonymous: false });
}

/** Contexte d'action IA : runQuery en file déterministe (ordre des appels). */
function actionCtx(db: MemoryDb, queryResults: unknown[]) {
  const base = makeMutationCtx(db);
  return {
    ...base,
    runMutation: async () => ({ allowed: true, retryAfterMs: 0 }),
    runQuery: async () => queryResults.shift(),
    scheduler: { runAfter: async () => undefined },
  };
}

function errorCode(e: unknown): string | undefined {
  if (e instanceof ConvexError) return (e.data as { code?: string })?.code;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* 1. Limite d'1 scan (recordScan + démo)                              */
/* ------------------------------------------------------------------ */

describe("Mode invité — limite d'1 scan (côté serveur)", () => {
  test("constante GUEST_MAX_SCANS = 1 (démo : un seul scan, jamais plus)", () => {
    expect(guest.GUEST_MAX_SCANS).toBe(1);
  });

  test("recordScan bloque un invité qui a déjà utilisé son scan unique", async () => {
    const db = makeDb();
    seedGuestUser(db);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 1 });

    setCurrentUser(GUEST_ID);
    let err: unknown;
    try {
      await call(
        scans.recordScan,
        makeMutationCtx(db) as never,
        { storageIds: [], analysis: validAnalysis(), mode: "quick" } as never,
      );
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("recordScan autorise le premier scan de l'invité puis incrémente le compteur", async () => {
    const db = makeDb();
    seedGuestUser(db);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 0 });

    setCurrentUser(GUEST_ID);
    const id = await call<string>(
      scans.recordScan,
      makeMutationCtx(db) as never,
      { storageIds: [], analysis: validAnalysis(), mode: "quick" } as never,
    );
    expect(id).toBeTruthy();
    const usage = db.raw("usage")[0];
    expect(usage.scansCount).toBe(1);
    // Un second scan est maintenant refusé (le compteur a été incrémenté).
    let err: unknown;
    try {
      await call(
        scans.recordScan,
        makeMutationCtx(db) as never,
        { storageIds: [], analysis: validAnalysis(), mode: "quick" } as never,
      );
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("createDemoScan est bloqué pour un invité (contournerait le compteur)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 0 });

    setCurrentUser(GUEST_ID);
    let err: unknown;
    try {
      await call(scans.createDemoScan, makeMutationCtx(db) as never, {});
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("les comptes classiques gardent leur limite gratuite (pas affectés par l'invité)", async () => {
    const db = makeDb();
    seedNormalUser(db);
    seedUsage(db, { id: "usage-1", owner: NORMAL_ID, scans: 4 });

    setCurrentUser(NORMAL_ID);
    let err: unknown;
    try {
      await call(
        scans.recordScan,
        makeMutationCtx(db) as never,
        { storageIds: [], analysis: validAnalysis(), mode: "quick" } as never,
      );
    } catch (e) {
      err = e;
    }
    // Limite GRATUITE (4/mois), pas la limite invité.
    expect(errorCode(err)).toBe("LIMIT_REACHED");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Fiches & quiz réservés aux comptes                               */
/* ------------------------------------------------------------------ */

describe("Mode invité — fiches et quiz bloqués", () => {
  test("createSheet d'un invité est refusé (GUEST_LIMIT_REACHED)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 0 });

    setCurrentUser(GUEST_ID);
    let err: unknown;
    try {
      await call(
        revisionSheets.createSheet,
        makeMutationCtx(db) as never,
        {
          title: "Fiche test",
          subject: "Mathématiques",
          level: "seconde",
          sourceType: "scan",
          storageIds: [],
          content: {
            summary: "résumé",
            keyPoints: ["point"],
            formulas: [{ name: "f", formula: "x" }],
            methods: ["m"],
            example: { question: "q", solution: "s" },
            pitfalls: ["p"],
            takeaways: ["t"],
          },
        } as never,
      );
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("saveQuiz d'un invité est refusé (GUEST_LIMIT_REACHED)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 0 });

    setCurrentUser(GUEST_ID);
    let err: unknown;
    try {
      await call(
        quizzes.saveQuiz,
        makeMutationCtx(db) as never,
        {
          subject: "Mathématiques",
          level: "seconde",
          title: "Quiz test",
          settings: { count: 5, difficulty: "facile", types: ["qcm"] },
          questions: [],
        } as never,
      );
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("listMySheets / listMyQuizzes / getQuiz ne renvoient RIEN à un invité", async () => {
    const db = makeDb();
    seedGuestUser(db);
    // Des données existent pour l'invité… mais elles ne doivent jamais
    // transiter vers le client (ni liste ni lecture directe).
    db.seed("revision_sheets", [
      { _id: "revision_sheets-1", userId: GUEST_ID, title: "Fiche", subject: "Maths", level: "seconde", sourceType: "scan", storageIds: [], content: {}, createdAt: Date.now(), updatedAt: Date.now() },
    ]);
    db.seed("quizzes", [
      { _id: "quizzes-1", userId: GUEST_ID, subject: "Maths", level: "seconde", title: "Quiz", settings: { count: 5, difficulty: "facile", types: ["qcm"] }, questions: [], status: "pending", createdAt: Date.now() },
    ]);

    setCurrentUser(GUEST_ID);
    const ctx = makeMutationCtx(db);
    expect(
      await call<Array<{ _id: string }>>(revisionSheets.listMySheets, ctx as never, {}),
    ).toEqual([]);
    expect(
      await call<Array<{ _id: string }>>(quizzes.listMyQuizzes, ctx as never, {}),
    ).toEqual([]);
    expect(
      await call(quizzes.getQuiz, ctx as never, { quizId: "quizzes-1" }),
    ).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 3. Historique & progression masqués, résultat unique accessible     */
/* ------------------------------------------------------------------ */

describe("Mode invité — historique/progression masqués", () => {
  test("listMyScans renvoie [] même si le scan de démo existe", async () => {
    const db = makeDb();
    seedGuestUser(db);
    db.seed("scans", [
      { _id: "scans-1", userId: GUEST_ID, storageIds: [], subject: "Maths", topic: "Équations", level: "seconde", title: "Exo", status: "done", mode: "quick", createdAt: Date.now() },
    ]);

    setCurrentUser(GUEST_ID);
    expect(
      await call<Array<{ _id: string }>>(scans.listMyScans, makeMutationCtx(db) as never, {}),
    ).toEqual([]);
  });

  test("getScan reste accessible pour lire SON résultat (accès au scan de démo)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    db.seed("scans", [
      { _id: "scans-1", userId: GUEST_ID, storageIds: [], subject: "Maths", topic: "Équations", level: "seconde", title: "Exo", status: "done", mode: "quick", createdAt: Date.now(), result: validAnalysis() },
    ]);

    setCurrentUser(GUEST_ID);
    const scan = await call(scans.getScan, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    });
    expect(scan).not.toBeNull();
    expect((scan as { _id: string })._id).toBe("scans-1");
  });

  test("getMyStats renvoie null à un invité (aucune donnée de progression)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    setCurrentUser(GUEST_ID);
    expect(await call(usageMod.getMyStats, makeMutationCtx(db) as never, {})).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Actions IA : limites re-vérifiées AVANT toute génération         */
/* ------------------------------------------------------------------ */

describe("Mode invité — actions IA verrouillées côté serveur", () => {
  test("ocrPhotos bloque un invité qui a déjà utilisé son scan (avant tout appel IA)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    setCurrentUser(GUEST_ID);
    // File d'appels internes : isGuestById → true, getScansCountForUser → 1.
    const ctx = actionCtx(db, [true, 1]);

    let err: unknown;
    try {
      await call(ai.ocrPhotos, ctx as never, { storageIds: ["file-1"] });
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("ocrPhotos autorise l'invité à 0 scan (mode démo, aucune clé requise)", async () => {
    const db = makeDb();
    seedGuestUser(db);
    setCurrentUser(GUEST_ID);
    // isGuestById → true, getScansCountForUser → 0, ownership → vide.
    const ctx = actionCtx(db, [true, 0, { owned: {} }]);

    const result = await call<{ fullText: string }>(ai.ocrPhotos, ctx as never, {
      storageIds: [],
    });
    // Sans clé IA configurée, le pipeline retourne l'OCR de démonstration.
    expect(typeof result.fullText).toBe("string");
    expect(result.fullText.length).toBeGreaterThan(0);
  });

  test("generateSheet d'un invité est refusé dans l'action IA elle-même", async () => {
    const db = makeDb();
    seedGuestUser(db);
    setCurrentUser(GUEST_ID);
    const ctx = actionCtx(db, [true]); // isGuestById → true

    let err: unknown;
    try {
      await call(ai.generateSheet, ctx as never, { storageIds: [], subject: "Maths" });
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });

  test("generateQuiz d'un invité est refusé dans l'action IA elle-même", async () => {
    const db = makeDb();
    seedGuestUser(db);
    setCurrentUser(GUEST_ID);
    const ctx = actionCtx(db, [true]); // isGuestById → true

    let err: unknown;
    try {
      await call(
        ai.generateQuiz,
        ctx as never,
        { subject: "Maths", level: "seconde", count: 5, difficulty: "facile", types: ["qcm"], topic: "Équations" } as never,
      );
    } catch (e) {
      err = e;
    }
    expect(errorCode(err)).toBe("GUEST_LIMIT_REACHED");
  });
});

/* ------------------------------------------------------------------ */
/* 5. Aucune donnée persistée après la session                         */
/* ------------------------------------------------------------------ */

describe("Mode invité — aucune donnée persistée", () => {
  test("wipeMyGuestData supprime tout (scans, fiches, quiz, uploads, auth) puis le compte", async () => {
    const db = makeDb();
    seedGuestUser(db);
    db.seed("scans", [
      { _id: "scans-1", userId: GUEST_ID, storageIds: ["file-scan-1"], subject: "Maths", topic: "t", level: "l", title: "Exo", status: "done", mode: "quick", createdAt: Date.now() },
    ]);
    db.seed("revision_sheets", [
      { _id: "revision_sheets-1", userId: GUEST_ID, title: "F", subject: "Maths", level: "l", sourceType: "scan", storageIds: ["file-sheet-1"], content: {}, createdAt: Date.now(), updatedAt: Date.now() },
    ]);
    db.seed("quizzes", [
      { _id: "quizzes-1", userId: GUEST_ID, subject: "Maths", level: "l", title: "Q", settings: {}, questions: [], status: "pending", createdAt: Date.now() },
    ]);
    db.seed("quiz_answers", [
      { _id: "quiz_answers-1", userId: GUEST_ID, quizId: "quizzes-1", questionIndex: 0, isCorrect: true, subject: "Maths" },
    ]);
    db.seed("uploads", [
      { _id: "uploads-1", userId: GUEST_ID, storageId: "file-scan-1" },
    ]);
    seedUsage(db, { id: "usage-1", owner: GUEST_ID, scans: 1 });
    db.seed("subscriptions", [{ _id: "subscriptions-1", userId: GUEST_ID, plan: "free", status: "active" }]);
    db.seed("authAccounts", [{ _id: "authAccounts-1", userId: GUEST_ID, provider: "anonymous", account: {} }]);
    db.seed("authSessions", [{ _id: "authSessions-1", userId: GUEST_ID, expires: Date.now() + 1000 }]);
    db.seed("authRefreshTokens", [{ _id: "authRefreshTokens-1", sessionId: "authSessions-1" }]);
    db.seed("authVerificationCodes", [{ _id: "authVerificationCodes-1", accountId: "authAccounts-1", code: "123456" }]);

    setCurrentUser(GUEST_ID);
    const res = await call<{ deletedScans: number }>(
      guest.wipeMyGuestData,
      makeMutationCtx(db) as never,
      {},
    );
    expect(res.deletedScans).toBe(1);

    // Tout est supprimé, y compris le compte invité lui-même.
    expect(db.raw("scans")).toHaveLength(0);
    expect(db.raw("revision_sheets")).toHaveLength(0);
    expect(db.raw("quizzes")).toHaveLength(0);
    expect(db.raw("quiz_answers")).toHaveLength(0);
    expect(db.raw("uploads")).toHaveLength(0);
    expect(db.raw("usage")).toHaveLength(0);
    expect(db.raw("subscriptions")).toHaveLength(0);
    expect(db.raw("authAccounts")).toHaveLength(0);
    expect(db.raw("authSessions")).toHaveLength(0);
    expect(db.raw("authRefreshTokens")).toHaveLength(0);
    expect(db.raw("authVerificationCodes")).toHaveLength(0);
    expect(db.raw("users")).toHaveLength(0);
    // Les fichiers du stockage sont purgés aussi.
    expect(mockStorage.deleted).toContain("file-scan-1");
    expect(mockStorage.deleted).toContain("file-sheet-1");
  });

  test("wipeMyGuestData ne touche JAMAIS un compte classique", async () => {
    const db = makeDb();
    seedNormalUser(db);
    db.seed("scans", [
      { _id: "scans-1", userId: NORMAL_ID, storageIds: [], subject: "Maths", topic: "t", level: "l", title: "Exo", status: "done", mode: "quick", createdAt: Date.now() },
    ]);

    setCurrentUser(NORMAL_ID);
    const res = await call(guest.wipeMyGuestData, makeMutationCtx(db) as never, {});
    expect(res).toBeNull();
    expect(db.raw("scans")).toHaveLength(1);
    expect(db.raw("users")).toHaveLength(1);
  });

  test("cleanupGuestAccounts purge uniquement les invités dont la session est abandonnée", async () => {
    const db = makeDb();
    const old = Date.now() - 100 * 24 * 60 * 60 * 1000; // ~100 jours
    const fresh = Date.now() - 60 * 1000; // actif il y a 1 min
    db.seed("users", [
      { _id: "users-stale", name: "Ancien", email: "s@test.fr", isAnonymous: true, _creationTime: old },
      { _id: "users-fresh", name: "Actif", email: "f@test.fr", isAnonymous: true, _creationTime: fresh },
      { _id: "users-classic", name: "Classic", email: "c@test.fr", isAnonymous: false, _creationTime: old },
    ]);
    db.seed("scans", [
      { _id: "scans-1", userId: "users-stale", storageIds: [], subject: "Maths", topic: "t", level: "l", title: "Exo", status: "done", mode: "quick", createdAt: old },
    ]);

    const res = await call<{ deleted: number }>(
      guest.cleanupGuestAccounts,
      makeMutationCtx(db) as never,
      {},
    );
    expect(res.deleted).toBe(1);
    expect(db.raw("users").map((u) => u._id).sort()).toEqual([
      "users-classic",
      "users-fresh",
    ]);
    expect(db.raw("scans")).toHaveLength(0);
  });
});
