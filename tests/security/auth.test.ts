/**
 * Tests de sécurité — Authentification, autorisation, mass assignment, IDOR.
 *
 * On appelle les handlers Convex directement avec un contexte simulé
 * (jamais de backend déployé, jamais de clé tierce).
 */
import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";

import * as scans from "@/convex/scans";
import * as sheets from "@/convex/revisionSheets";
import * as quizzes from "@/convex/quizzes";
import * as users from "@/convex/users";

import {
  call,
  makeDb,
  makeMutationCtx,
  makeQueryCtx,
  mockStorage,
  seedScan,
  seedUsage,
  seedUser,
  setCurrentUser,
  uid,
} from "../helpers/mock-convex";
import * as usage from "@/convex/usage";

/* ------------------------------------------------------------------ */
/* 1. Échecs d'authentification                                       */
/* ------------------------------------------------------------------ */

describe("Authentification — requêtes non authentifiées", () => {
  test("recordScan sans session → UNAUTHENTICATED", async () => {
    setCurrentUser(null);
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    await expect(
      call(scans.recordScan, ctx as never, {
        storageIds: [],
        analysis: {
          detection: {
            subject: "Mathématiques",
            topic: "Fonctions",
            level: "seconde",
            prompt: "f(x)=2x+3",
            data: "…",
            formulas: [],
            legible: true,
          },
          quick: { answer: "x=1", calculation: "…", keyPoint: "…" },
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
            title: "Correction complète",
            exercises: [
              {
                number: 1,
                question: "Résoudre dans ℝ : 2x + 3 = 7",
                answer: "x = 2",
                calculation: "2x = 4 → x = 2",
              },
            ],
          },
        },
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("createSheet sans session → UNAUTHENTICATED", async () => {
    setCurrentUser(null);
    const db = makeDb();
    await expect(
      call(sheets.createSheet, makeMutationCtx(db) as never, {
        title: "Fiche",
        subject: "Maths",
        level: "seconde",
        sourceType: "text",
        storageIds: [],
        content: {
          concepts: [],
          formulas: [],
          methods: [],
          example: { question: "", solution: "" },
          pitfalls: [],
          takeaways: [],
        },
      } as never),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("saveQuiz sans session → UNAUTHENTICATED", async () => {
    setCurrentUser(null);
    const db = makeDb();
    await expect(
      call(quizzes.saveQuiz, makeMutationCtx(db) as never, {
        subject: "Maths",
        level: "seconde",
        title: "Quiz",
        settings: { count: 5, difficulty: "easy", types: ["qcm"] },
        questions: [],
      } as never),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("updateProfile sans session → null (aucune donnée écrite)", async () => {
    setCurrentUser(null);
    const db = makeDb();
    const res = await call(users.updateProfile, makeMutationCtx(db) as never, {
      firstName: "Attaquant",
    } as never);
    expect(res).toBeNull();
  });

  test("queries non authentifiées → aucune donnée exposée", async () => {
    setCurrentUser(null);
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) });
    expect(
      await call<Array<{ _id: string }>>(scans.listMyScans, makeQueryCtx(db) as never, {}),
    ).toEqual([]);
    expect(
      await call<unknown>(scans.getScan, makeQueryCtx(db) as never, {
        scanId: "scans-1",
      } as never),
    ).toBeNull();
    expect(
      await call<Array<{ _id: string }>>(
        sheets.listMySheets,
        makeQueryCtx(db) as never,
        {},
      ),
    ).toEqual([]);
    expect(
      await call<Array<{ _id: string }>>(
        quizzes.listMyQuizzes,
        makeQueryCtx(db) as never,
        {},
      ),
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Autorisation — accès aux données d'un autre utilisateur (IDOR)  */
/* ------------------------------------------------------------------ */

describe("IDOR/BOLA — un utilisateur ne peut pas accéder aux données d'autrui", () => {
  test("getScan d'un autre utilisateur → null (donnée masquée)", async () => {
    setCurrentUser(uid(2)); // user 2 est connecté
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) }); // scan de user 1
    const res = await call(scans.getScan, makeQueryCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    expect(res).toBeNull();
  });

  test("listMyScans ne renvoie que ses propres scans", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) });
    seedScan(db, { id: "scans-2", owner: uid(2) });
    const res = await call<Array<{ _id: string }>>(
      scans.listMyScans,
      makeQueryCtx(db) as never,
      {},
    );
    expect(res.map((s) => s._id)).toEqual(["scans-2"]);
  });

  test("deleteScan d'un scan d'autrui → aucun effet", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1), storageIds: ["file-1"] });
    await call(scans.deleteScan, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    expect(db.raw("scans")).toHaveLength(1); // toujours présent
    expect(mockStorage.deleted).toEqual([]); // fichiers intacts
  });

  test("setFeedback / toggleSaved sur un scan d'autrui → sans effet", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) });
    await call(scans.setFeedback, makeMutationCtx(db) as never, {
      scanId: "scans-1",
      useful: true,
    } as never);
    await call(scans.toggleSaved, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    const doc = db.raw("scans")[0];
    expect(doc.feedback).toBeUndefined();
    expect(doc.saved).toBeUndefined();
  });

  test("getSheet / deleteSheet d'une fiche d'autrui → null / sans effet", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    db.seed("revision_sheets", [
      {
        _id: "revision_sheets-1",
        userId: uid(1),
        title: "Fiche secrète",
        subject: "Maths",
        level: "seconde",
        sourceType: "text",
        storageIds: ["file-9"],
        content: {
          concepts: [],
          formulas: [],
          methods: [],
          example: { question: "", solution: "" },
          pitfalls: [],
          takeaways: [],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const res = await call(sheets.getSheet, makeQueryCtx(db) as never, {
      sheetId: "revision_sheets-1",
    } as never);
    expect(res).toBeNull();
    await call(sheets.deleteSheet, makeMutationCtx(db) as never, {
      sheetId: "revision_sheets-1",
    } as never);
    expect(db.raw("revision_sheets")).toHaveLength(1);
  });

  test("getQuiz / saveQuizResult / deleteQuiz sur un quiz d'autrui → null / sans effet", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    db.seed("quizzes", [
      {
        _id: "quizzes-1",
        userId: uid(1),
        subject: "Maths",
        level: "seconde",
        title: "Quiz secret",
        settings: { count: 1, difficulty: "easy", types: ["qcm"] },
        questions: [
          {
            type: "qcm",
            question: "2+2 ?",
            options: ["3", "4"],
            answer: "4",
            explanation: "",
            topic: "additions",
          },
        ],
        status: "pending",
        createdAt: 1,
      },
    ]);
    const res = await call(quizzes.getQuiz, makeQueryCtx(db) as never, {
      quizId: "quizzes-1",
    } as never);
    expect(res).toBeNull();
    const result = await call(quizzes.saveQuizResult, makeMutationCtx(db) as never, {
      quizId: "quizzes-1",
      answers: [{ questionIndex: 0, selected: "4", isCorrect: true }],
      durationSeconds: 10,
    } as never);
    expect(result).toBeNull();
    await call(quizzes.deleteQuiz, makeMutationCtx(db) as never, {
      quizId: "quizzes-1",
    } as never);
    expect(db.raw("quizzes")).toHaveLength(1);
  });

  test("getMyUsage ne renvoie que son propre usage", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 3 });
    seedUsage(db, { id: "usage-2", owner: uid(2), scans: 99 });
    const res = await call<{ usage: { scans: number } }>(
      usage.getMyUsage,
      makeQueryCtx(db) as never,
      {},
    );
    expect(res?.usage.scans).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Mass assignment — champs protégés non écrasables par le body     */
/* ------------------------------------------------------------------ */

describe("Mass assignment — les champs protégés ne sont pas écrasables", () => {
  test("recordScan ignore un userId fourni par l'attaquant", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1) });
    await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: [],
      userId: uid(2), // tentative de forcer le propriétaire
      analysis: {
        detection: {
          subject: "Maths",
          topic: "Fonctions",
          level: "seconde",
          prompt: "…",
          data: "…",
          formulas: [],
          legible: true,
        },
        quick: { answer: "…", calculation: "…", keyPoint: "…" },
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
          title: "Correction complète",
          exercises: [
            {
              number: 1,
              question: "Résoudre dans ℝ : 2x + 3 = 7",
              answer: "x = 2",
              calculation: "2x = 4 → x = 2",
            },
          ],
        },
      },
      mode: "quick",
    } as never);
    const created = db.raw("scans")[0];
    expect(created.userId).toBe(uid(1)); // propriétaire réel
  });

  test("updateProfile ne peut pas modifier role / email / image (non exposés)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1), { role: "user" });
    await call(users.updateProfile, makeMutationCtx(db) as never, {
      firstName: "Léa",
      role: "admin", // tentative d'escalade
      email: "pirate@evil.fr",
      image: "https://evil.example/x.png",
      isAnonymous: false,
    } as never);
    const u = db.raw("users")[0];
    expect(u.firstName).toBe("Léa");
    expect(u.role).toBe("user"); // inchangé
    expect(u.email).toBe(`${uid(1)}@test.fr`); // inchangé
    expect(u.image).toBeUndefined();
    expect(u.isAnonymous).toBeUndefined();
  });

  test("saveQuiz ignore un userId / status forcé par l'attaquant", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1) });
    await call(quizzes.saveQuiz, makeMutationCtx(db) as never, {
      subject: "Maths",
      level: "seconde",
      title: "Quiz",
      settings: { count: 1, difficulty: "easy", types: ["qcm"] },
      questions: [],
      userId: uid(2),
      status: "done",
      score: 100,
    } as never);
    const q = db.raw("quizzes")[0];
    expect(q.userId).toBe(uid(1));
    expect(q.status).toBe("pending"); // forcé par le handler
    expect(q.score).toBeUndefined();
  });
});

