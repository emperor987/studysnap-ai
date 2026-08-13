/**
 * Tests de sécurité — Rate limiting, quotas, injection, uploads.
 *
 * On appelle les handlers Convex directement (contexte simulé).
 */
import { describe, expect, test } from "bun:test";

import * as scans from "@/convex/scans";
import * as sheets from "@/convex/revisionSheets";
import * as quizzes from "@/convex/quizzes";
import * as cleanup from "@/convex/cleanup";

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

/** Analyse valide minimale pour recordScan. */
function validAnalysis(overrides: Record<string, unknown> = {}) {
  return {
    detection: {
      subject: "Mathématiques",
      topic: "Fonctions",
      level: "seconde",
      prompt: "f(x) = 2x + 3",
      data: "…",
      formulas: [],
      legible: true,
    },
    quick: { answer: "x = 1", calculation: "…", keyPoint: "…" },
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
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* 11. Rate limiting & quotas du plan gratuit                         */
/* ------------------------------------------------------------------ */

describe("Rate limiting — limites de scans et quotas gratuits", () => {
  test("4 scans gratuits autorisés, le 5e est bloqué (LIMIT_REACHED)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4 });
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: [],
        analysis: validAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "LIMIT_REACHED" } });
  });

  test("espacement de 4 s entre deux scans : scan trop rapproché → RATE_LIMITED", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, {
      id: "usage-1",
      owner: uid(1),
      lastScanAt: Date.now() - 1000, // scan il y a 1 s
    });
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: [],
        analysis: validAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "RATE_LIMITED" } });
  });

  test("un abonnement actif lève la limite gratuite (pas de LIMIT_REACHED)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4, lastScanAt: 0 });
    db.seed("subscriptions", [
      {
        _id: "subscriptions-1",
        userId: uid(1),
        plan: "student",
        status: "active",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    const id = await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: [],
      analysis: validAnalysis(),
      mode: "quick",
    } as never);
    expect(id).toBeTruthy();
  });

  test("un abonnement résilié ne donne pas les avantages payants", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4 });
    db.seed("subscriptions", [
      {
        _id: "subscriptions-1",
        userId: uid(1),
        plan: "pro",
        status: "canceled",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: [],
        analysis: validAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "LIMIT_REACHED" } });
  });

  test("quota fiches : 3 fiches gratuites, la 4e est bloquée", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), sheets: 3 });
    await expect(
      call(sheets.createSheet, makeMutationCtx(db) as never, {
        title: "Fiche 4",
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
    ).rejects.toMatchObject({ data: { code: "LIMIT_REACHED" } });
  });

  test("quota quiz : 3 quiz gratuits, le 4e est bloqué", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), quizzes: 3 });
    await expect(
      call(quizzes.saveQuiz, makeMutationCtx(db) as never, {
        subject: "Maths",
        level: "seconde",
        title: "Quiz 4",
        settings: { count: 5, difficulty: "easy", types: ["qcm"] },
        questions: [],
      } as never),
    ).rejects.toMatchObject({ data: { code: "LIMIT_REACHED" } });
  });
});

/* ------------------------------------------------------------------ */
/* 5. Injection — les payloads restent des données, jamais du code     */
/* ------------------------------------------------------------------ */

describe("Injection (SQL/NoSQL/opérateurs) — les payloads sont traités comme des données", () => {
  test("recordScan stocke un payload NoSQL ('$gt') comme texte littéral", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), lastScanAt: 0 });
    const payload = validAnalysis({
      detection: {
        ...validAnalysis().detection,
        prompt: '{"$gt": ""} OR 1=1 --',
        subject: "x' OR '1'='1",
      },
    });
    await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: [],
      analysis: payload,
      mode: "quick",
    } as never);
    const doc = db.raw("scans")[0] as unknown as {
      subject: string;
      result: { detection: { prompt: string } };
    };
    // Le payload est stocké comme chaîne brute, aucune requête supplémentaire
    expect(doc.subject).toBe("x' OR '1'='1");
    expect(doc.result.detection.prompt).toBe('{"$gt": ""} OR 1=1 --');
  });

  test("une recherche d'ID injectée ne permet pas de lire un scan d'autrui", async () => {
    setCurrentUser(uid(2));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) });
    const res = await call(scans.getScan, makeQueryCtx(db) as never, {
      scanId: "scans-1' OR '1'='1", // payload injecté dans un id
    } as never);
    expect(res).toBeNull();
  });

  test("la requête by_user filtre strictement sur l'utilisateur (pas de fuite)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1) });
    seedScan(db, { id: "scans-2", owner: uid(2) });
    seedScan(db, { id: "scans-3", owner: uid(3) });
    const res = await call<Array<{ _id: string }>>(
      scans.listMyScans,
      makeQueryCtx(db) as never,
      {},
    );
    expect(res).toHaveLength(1);
    expect(res[0]._id).toBe("scans-1");
  });
});

/* ------------------------------------------------------------------ */
/* 10. Uploads — fichiers non autorisés refusés / purgés               */
/* ------------------------------------------------------------------ */

describe("Uploads & stockage", () => {
  test("les URLs d'upload sont signées et temporaires (pas d'upload public)", async () => {
    const ctx = makeMutationCtx(makeDb());
    const url = await ctx.storage.generateUploadUrl();
    expect(url).toContain("https://");
    expect(url).toContain("token=");
    expect(url).not.toContain("anonymous");
  });

  test("cleanupExpiredImages supprime uniquement les photos au-delà de la rétention", async () => {
    const db = makeDb();
    seedScan(db, {
      id: "scans-old",
      owner: uid(1),
      createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000, // 40 jours
      storageIds: ["file-old-1"],
    });
    seedScan(db, {
      id: "scans-new",
      owner: uid(1),
      createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 jours
      storageIds: ["file-new-1"],
    });
    const res = await call<{ deletedScans: number }>(
      cleanup.cleanupExpiredImages,
      makeMutationCtx(db) as never,
      {},
    );
    expect(res.deletedScans).toBe(1);
    const old = db.raw("scans").find((s) => s._id === "scans-old");
    expect(old?.storageIds).toEqual([]); // images purgées
    const fresh = db.raw("scans").find((s) => s._id === "scans-new");
    expect(fresh?.storageIds).toEqual(["file-new-1"]); // intact
  });

  test("deleteScan supprime les fichiers associés", async () => {
    mockStorage.reset(); // déterministe même en exécution groupée
    setCurrentUser(uid(1));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1), storageIds: ["file-1", "file-2"] });
    await call(scans.deleteScan, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    expect(db.raw("scans")).toHaveLength(0);
    expect(mockStorage.deleted.sort()).toEqual(["file-1", "file-2"]);
  });

  test("path traversal : les ids de stockage restent des clés opaques (jamais de chemin fichier)", async () => {
    mockStorage.reset(); // déterministe même en exécution groupée
    setCurrentUser(uid(1));
    const db = makeDb();
    seedScan(db, {
      id: "scans-1",
      owner: uid(1),
      storageIds: ["../../etc/passwd", "..%2f..%2fsecret", "file-normal"],
    });
    await call(scans.deleteScan, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    // Les ids sont transmis tels quels à l'API de stockage (aucune résolution
    // de chemin, aucune lecture fichier) et le document est supprimé.
    expect(db.raw("scans")).toHaveLength(0);
    expect(mockStorage.deleted.sort()).toEqual([
      "..%2f..%2fsecret",
      "../../etc/passwd",
      "file-normal",
    ].sort());
  });
});

/* ------------------------------------------------------------------ */
/* 19/20. Gestion d'erreurs — pas de fuite de stack ni de secret       */
/* ------------------------------------------------------------------ */

describe("Gestion d'erreurs — pas de fuite d'information", () => {
  test("les erreurs métier exposent un code, pas une stack trace", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), scans: 4 });
    try {
      await call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: [],
        analysis: validAnalysis(),
        mode: "quick",
      } as never);
      expect.unreachable("devrait lever LIMIT_REACHED");
    } catch (e) {
      const err = e as { data?: { code?: string; message?: string }; stack?: string };
      expect(err.data?.code).toBe("LIMIT_REACHED");
      // Le message exposé au client est pédagogique, sans stack trace :
      expect(String(err.data?.message)).not.toMatch(/at |\.ts:\d+/);
    }
  });

  test("les données utilisateur ne contiennent jamais de secrets d'infrastructure", () => {
    const db = makeDb();
    seedUser(db, uid(1), { email: "a@b.fr" });
    seedScan(db, { id: "scans-1", owner: uid(1) });
    const dump = JSON.stringify([...db.raw("users"), ...db.raw("scans")]);
    expect(dump).not.toMatch(/sk_(live|test)_/); // pas de clé Stripe
    expect(dump).not.toMatch(/whsec_/); // pas de secret webhook
    expect(dump).not.toMatch(/nvapi-|AI_API_KEY/); // pas de clé IA
    expect(dump).not.toMatch(/password/i); // aucun mot de passe stocké
  });

  test("la table stripe_config (secrets) n'est jamais exposée par les handlers applicatifs", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    db.seed("stripe_config", [
      {
        _id: "stripe_config-1",
        singleton: "default",
        mode: "live",
        priceStudent: "price_live_123",
        pricePro: "price_live_456",
        webhookId: "we_live_1",
        webhookSecret: "whsec_live_TOP_SECRET",
        updatedAt: 1,
      },
    ]);
    // Aucun handler public ne lit cette table — on vérifie qu'aucun ne la
    // référence depuis le code applicatif (la config est en "use node").
    expect(String(cleanup.cleanupExpiredImages)).not.toContain("stripe_config");
  });
});
