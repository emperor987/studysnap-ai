/**
 * Tests de sécurité — BOLA/IDOR sur le stockage d'images.
 *
 * Un storageId ne doit jamais être utilisable par un autre compte : ni pour
 * résoudre une URL signée, ni pour être attaché à un scan/une fiche, ni pour
 * être OCRisé (fuite de contenu), ni pour être supprimé (suppression croisée).
 * Toute violation doit lever INVALID_UPLOAD (mutations/actions) ou renvoyer
 * null (queries).
 */
import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";

import * as files from "@/convex/files";
import * as scans from "@/convex/scans";
import * as ai from "@/convex/ai";
import * as rateLimit from "@/convex/rateLimit";

import {
  call,
  makeDb,
  makeMutationCtx,
  makeQueryCtx,
  seedScan,
  seedUsage,
  seedUser,
  setCurrentUser,
  uid,
} from "../helpers/mock-convex";

/** Analyse valide minimale pour recordScan. */
function validAnalysis() {
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
  };
}

/* ------------------------------------------------------------------ */
/* 1. Uploads — session obligatoire                                    */
/* ------------------------------------------------------------------ */

describe("Uploads — session obligatoire", () => {
  test("generateUploadUrl sans session → UNAUTHENTICATED", async () => {
    setCurrentUser(null);
    await expect(
      call(files.generateUploadUrl, makeMutationCtx(makeDb()) as never, {}),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });

  test("registerUpload sans session → UNAUTHENTICATED", async () => {
    setCurrentUser(null);
    await expect(
      call(files.registerUpload, makeMutationCtx(makeDb()) as never, {
        storageId: "file-1",
      } as never),
    ).rejects.toMatchObject({ data: { code: "UNAUTHENTICATED" } });
  });
});

/* ------------------------------------------------------------------ */
/* 2. getStorageUrl — lecture réservée au propriétaire                 */
/* ------------------------------------------------------------------ */

describe("getStorageUrl — BOLA : lecture réservée au propriétaire", () => {
  test("sans session → null (aucune URL signée exposée)", async () => {
    setCurrentUser(null);
    const db = makeDb();
    const res = await call(
      files.getStorageUrl,
      makeQueryCtx(db) as never,
      { storageId: "file-1" } as never,
    );
    expect(res).toBeNull();
  });

  test("storageId d'un autre compte → null (même si l'id est connu)", async () => {
    const db = makeDb();
    // user 1 enregistre file-1 et a un scan qui le référence
    setCurrentUser(uid(1));
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-1",
      contentType: "image/jpeg",
    } as never);
    seedScan(db, { id: "scans-1", owner: uid(1), storageIds: ["file-1"] });
    // l'attaquant (user 2) tente de lire l'URL signée
    setCurrentUser(uid(2));
    const res = await call(files.getStorageUrl, makeQueryCtx(db) as never, {
      storageId: "file-1",
    } as never);
    expect(res).toBeNull();
  });

  test("son propre fichier enregistré → URL signée", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-mine",
      contentType: "image/jpeg",
    } as never);
    const res = await call(files.getStorageUrl, makeQueryCtx(db) as never, {
      storageId: "file-mine",
    } as never);
    expect(res).toContain("https://");
  });

  test("rétro-compatibilité : fichier référencé par SON scan → URL", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedScan(db, { id: "scans-1", owner: uid(1), storageIds: ["file-legacy"] });
    const res = await call(files.getStorageUrl, makeQueryCtx(db) as never, {
      storageId: "file-legacy",
    } as never);
    expect(res).toContain("https://");
  });
});

/* ------------------------------------------------------------------ */
/* 3. recordScan / createSheet — pas de référence à un fichier d'autrui */
/* ------------------------------------------------------------------ */

describe("recordScan — les storageIds doivent appartenir à l'utilisateur", () => {
  test("storageId non enregistré par l'utilisateur → INVALID_UPLOAD", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), lastScanAt: 0 });
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: ["file-pirate"],
        analysis: validAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "INVALID_UPLOAD" } });
  });

  test("storageId enregistré par un AUTRE compte → INVALID_UPLOAD", async () => {
    const db = makeDb();
    // user 1 enregistre file-1
    setCurrentUser(uid(1));
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-1",
      contentType: "image/jpeg",
    } as never);
    // l'attaquant (user 2) tente d'attacher file-1 à SON scan
    setCurrentUser(uid(2));
    seedUser(db, uid(2));
    seedUsage(db, { id: "usage-2", owner: uid(2), lastScanAt: 0 });
    await expect(
      call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: ["file-1"],
        analysis: validAnalysis(),
        mode: "quick",
      } as never),
    ).rejects.toMatchObject({ data: { code: "INVALID_UPLOAD" } });
  });

  test("ses propres fichiers enregistrés → scan créé", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), lastScanAt: 0 });
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-mine",
      contentType: "image/jpeg",
    } as never);
    const id = await call(scans.recordScan, makeMutationCtx(db) as never, {
      storageIds: ["file-mine"],
      analysis: validAnalysis(),
      mode: "quick",
    } as never);
    expect(id).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* 4. Actions IA — jamais d'OCR d'une image d'autrui                   */
/* ------------------------------------------------------------------ */

/**
 * Contexte d'action : dispatche runQuery vers checkStorageOwnership.
 *
 * (Le module `_generated/api` peut produire des références différentes selon
 * le résolveur — on ne compare pas les identités de références, on dispatche
 * toutes les runQuery vers le seul internalQuery utilisé par le chemin testé.)
 */
function makeActionCtx(db: ReturnType<typeof makeDb>) {
  const base = makeMutationCtx(db);
  return {
    ...base,
    // Dispatch par la forme des arguments (les références internes Convex
    // sont opaques ici) :
    //  - { storageIds, userId } → le seul internalQuery du chemin testé :
    //    checkStorageOwnership (propriété des fichiers) ;
    //  - { userId } seul → les nouveaux internals du mode invité
    //    (guest.isGuestById) : les comptes de ces tests sont CLASSIQUES
    //    (jamais anonymes) → false, la limite invité ne s'applique pas.
    runQuery: async (_fn: unknown, args: unknown) => {
      const a = args as { storageIds?: unknown; userId?: string };
      if (Array.isArray(a.storageIds)) {
        return call(files.checkStorageOwnership, makeQueryCtx(db), args);
      }
      return false;
    },
    // Les actions IA consomment la limite horaire (rateLimit:consume) avant
    // le traitement : on dispatche vers la vraie mutation pour que le seau
    // soit appliqué (et pour couvrir ce chemin dans les tests).
    runMutation: async (_fn: unknown, args: unknown) =>
      call(rateLimit.consume, makeMutationCtx(db), args),
    scheduler: { runAfter: async () => undefined },
  };
}

describe("Actions IA — l'OCR n'accepte que ses propres fichiers", () => {
  test("storageId d'un autre compte → INVALID_UPLOAD (avant tout traitement)", async () => {
    const db = makeDb();
    // user 1 enregistre file-secrete
    setCurrentUser(uid(1));
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-secrete",
      contentType: "image/jpeg",
    } as never);
    // l'attaquant (user 2) tente de faire OCR la photo privée de user 1
    setCurrentUser(uid(2));
    await expect(
      call(ai.ocrPhotos, makeActionCtx(db) as never, {
        storageIds: ["file-secrete"],
        contentTypes: ["image/jpeg"],
      } as never),
    ).rejects.toMatchObject({ data: { code: "INVALID_UPLOAD" } });
  });

  test("ses propres fichiers → OCR démarré (mode démo, aucune clé requise)", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-mine",
      contentType: "image/jpeg",
    } as never);
    const res = await call<{ fullText?: string }>(
      ai.ocrPhotos,
      makeActionCtx(db) as never,
      { storageIds: ["file-mine"], contentTypes: ["image/jpeg"] } as never,
    );
    expect(res?.fullText?.length ?? 0).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/* 5. Suppression — les enregistrements d'uploads suivent le compte     */
/* ------------------------------------------------------------------ */

describe("Cycle de vie des uploads", () => {
  test("deleteScan supprime aussi les entrées du registre", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-1",
      contentType: "image/jpeg",
    } as never);
    seedScan(db, { id: "scans-1", owner: uid(1), storageIds: ["file-1"] });
    await call(scans.deleteScan, makeMutationCtx(db) as never, {
      scanId: "scans-1",
    } as never);
    expect(db.raw("uploads")).toHaveLength(0);
  });

  test("registerUpload idempotent : ne peut pas capturer le fichier d'un autre", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    await call(files.registerUpload, makeMutationCtx(db) as never, {
      storageId: "file-1",
    } as never);
    setCurrentUser(uid(2)); // user 2 tente de s'approprier file-1
    const res = await call<{ owned: boolean }>(
      files.registerUpload,
      makeMutationCtx(db) as never,
      { storageId: "file-1" } as never,
    );
    expect(res.owned).toBe(false);
    const reg = db.raw("uploads")[0];
    expect(reg.userId).toBe(uid(1)); // propriétaire inchangé
  });

  test("l'erreur INVALID_UPLOAD n'expose ni stack ni détail interne", async () => {
    setCurrentUser(uid(1));
    const db = makeDb();
    seedUser(db, uid(1));
    seedUsage(db, { id: "usage-1", owner: uid(1), lastScanAt: 0 });
    try {
      await call(scans.recordScan, makeMutationCtx(db) as never, {
        storageIds: ["file-inexistant"],
        analysis: validAnalysis(),
        mode: "quick",
      } as never);
      expect.unreachable("devrait lever INVALID_UPLOAD");
    } catch (e) {
      const err = e as ConvexError<{ code?: string; message?: string }>;
      expect(err.data?.code).toBe("INVALID_UPLOAD");
      expect(String(err.data?.message)).not.toMatch(/at |\.ts:\d+/);
    }
  });
});
