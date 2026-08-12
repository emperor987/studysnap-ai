/**
 * Tests de sécurité — Rate limiting distribué (table rate_limits) :
 *
 * - seau à fenêtre glissante : consommation jusqu'au plafond, blocage avec
 *   retryAfterMs, réinitialisation à l'expiration de la fenêtre ;
 * - envois de codes OTP : au plus 3 par email sur 15 min (emailOtp.ts) ;
 * - endpoints IA coûteux : plafond par compte/heure sur les 4 actions
 *   (ai.ts), lève ConvexError RATE_LIMITED ;
 * - purge des seaux inactifs (cron hebdomadaire).
 *
 * Aucun backend déployé : contexte simulé + fonctions Convex appelées
 * directement. Aucune clé tierce requise.
 */
import { afterEach, describe, expect, test, vi } from "bun:test";
import { ConvexError } from "convex/values";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as ai from "@/convex/ai";
import * as rateLimit from "@/convex/rateLimit";
import { emailOtp } from "@/convex/auth/emailOtp";

import {
  call,
  makeDb,
  makeMutationCtx,
  setCurrentUser,
  uid,
  type MemoryDb,
} from "../helpers/mock-convex";

function consumeCtx(db: MemoryDb) {
  const base = makeMutationCtx(db);
  return {
    ...base,
    runMutation: async (_fn: unknown, args: unknown) =>
      call(rateLimit.consume, makeMutationCtx(db), args),
    runQuery: async () => null,
    scheduler: { runAfter: async () => undefined },
  };
}

/* ------------------------------------------------------------------ */
/* 1. Seau à fenêtre glissante — comportement de base                   */
/* ------------------------------------------------------------------ */

describe("rateLimit:consume — fenêtre glissante distribuée", () => {
  test("autorise jusqu'au plafond puis bloque avec retryAfterMs > 0", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    const args = { key: "test:1", windowMs: 60_000, max: 3 };

    for (let i = 0; i < 3; i++) {
      const r = await call<{ allowed: boolean; retryAfterMs: number }>(
        rateLimit.consume,
        ctx as never,
        args as never,
      );
      expect(r.allowed).toBe(true);
    }
    const blocked = await call<{ allowed: boolean; retryAfterMs: number }>(
      rateLimit.consume,
      ctx as never,
      args as never,
    );
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  test("la fenêtre expirée réinitialise le compteur", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    const args = { key: "test:window", windowMs: 60_000, max: 2 };

    await call(rateLimit.consume, ctx as never, args as never);
    await call(rateLimit.consume, ctx as never, args as never);
    const blocked = await call<{ allowed: boolean }>(
      rateLimit.consume,
      ctx as never,
      args as never,
    );
    expect(blocked.allowed).toBe(false);

    // On vieillit artificiellement le seau au-delà de la fenêtre…
    const row = db.raw("rate_limits")[0];
    db.patch("rate_limits", row._id as string, {
      windowStart: Date.now() - 61_000,
    });
    // …la consommation suivante ouvre une nouvelle fenêtre.
    const reset = await call<{ allowed: boolean }>(
      rateLimit.consume,
      ctx as never,
      args as never,
    );
    expect(reset.allowed).toBe(true);
  });

  test("les seaux sont indépendants (une clé ne bloque pas les autres)", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    await call(rateLimit.consume, ctx as never, {
      key: "otp:a@b.fr",
      windowMs: 60_000,
      max: 1,
    } as never);
    const other = await call<{ allowed: boolean }>(
      rateLimit.consume,
      ctx as never,
      { key: "otp:c@d.fr", windowMs: 60_000, max: 1 } as never,
    );
    expect(other.allowed).toBe(true);
  });

  test("purgeExpiredRows supprime uniquement les seaux inactifs", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    const args = { key: "test:purge", windowMs: 60_000, max: 1 };
    await call(rateLimit.consume, ctx as never, args as never);
    const row = db.raw("rate_limits")[0];
    db.patch("rate_limits", row._id as string, {
      updatedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 jours
    });
    const res = await call<{ deleted: number }>(
      rateLimit.purgeExpired,
      ctx as never,
      {} as never,
    );
    expect(res.deleted).toBe(1);
    expect(db.raw("rate_limits")).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Envois de codes OTP — 3 max / 15 min par email                    */
/* ------------------------------------------------------------------ */

describe("emailOtp — limite d'envoi de codes par email (anti-flood)", () => {
  const originalKey = process.env.FREEBUFF_EMAIL_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.FREEBUFF_EMAIL_API_KEY;
    else process.env.FREEBUFF_EMAIL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  test("3 envois autorisés, le 4e est refusé (message générique, aucun secret)", async () => {
    process.env.FREEBUFF_EMAIL_API_KEY = "fixture-key";
    const axios = (await import("axios")).default as unknown as {
      post: (..._args: unknown[]) => Promise<{ status: number }>;
    };
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200 } as never);

    const db = makeDb();
    const sendCtx = consumeCtx(db);
    const send = (
      emailOtp as unknown as {
        sendVerificationRequest: (
          o: { identifier: string; token: string },
          ctx?: unknown,
        ) => Promise<void>;
      }
    ).sendVerificationRequest;

    for (let i = 0; i < 3; i++) {
      await send({ identifier: "eleve@example.fr", token: `00000${i}` }, sendCtx);
    }
    expect(axios.post).toHaveBeenCalledTimes(3);

    try {
      await send({ identifier: "eleve@example.fr", token: "999999" }, sendCtx);
      expect.unreachable("le 4e envoi doit être bloqué");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Aucun secret ni détail dans l'erreur exposée.
      expect(msg).not.toContain("999999");
      expect(msg).not.toContain("fixture-key");
      expect(msg).not.toContain("eleve@example.fr");
      expect(msg.toLowerCase()).toContain("trop de demandes");
      expect(axios.post).toHaveBeenCalledTimes(3); // aucun 4e appel réseau
    }
  });

  test("sans contexte (tests directs), l'envoi n'est pas limité", async () => {
    process.env.FREEBUFF_EMAIL_API_KEY = "fixture-key";
    const axios = (await import("axios")).default as unknown as {
      post: (..._args: unknown[]) => Promise<{ status: number }>;
    };
    vi.spyOn(axios, "post").mockResolvedValue({ status: 200 } as never);
    const send = (
      emailOtp as unknown as {
        sendVerificationRequest: (o: { identifier: string; token: string }) => Promise<void>;
      }
    ).sendVerificationRequest;
    await send({ identifier: "a@b.fr", token: "111111" });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Endpoints IA — plafond par compte et par heure                    */
/* ------------------------------------------------------------------ */

describe("Actions IA — plafond de génération par compte/heure", () => {
  const originalMax = process.env.AI_RATE_LIMIT_MAX;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalMax === undefined) delete process.env.AI_RATE_LIMIT_MAX;
    else process.env.AI_RATE_LIMIT_MAX = originalMax;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    delete process.env.AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  test("analyzeText : 2 appels OK, le 3e lève RATE_LIMITED (sans appel IA)", async () => {
    process.env.NODE_ENV = "test"; // hors production, la surcharge s'applique
    process.env.AI_RATE_LIMIT_MAX = "2"; // surcharge de test uniquement
    setCurrentUser(uid(1));
    const db = makeDb();
    const ctx = consumeCtx(db);

    await call(ai.analyzeText, ctx as never, { text: "f(x) = 2x + 3" } as never);
    await call(ai.analyzeText, ctx as never, { text: "x² = 9" } as never);

    try {
      await call(ai.analyzeText, ctx as never, { text: "3e appel" } as never);
      expect.unreachable("le 3e appel doit être bloqué");
    } catch (e) {
      const err = e as ConvexError<{ code?: string; message?: string }>;
      expect(err.data?.code).toBe("RATE_LIMITED");
      const msg = String(err.data?.message ?? "");
      expect(msg).not.toMatch(/at |\.ts:\d+/); // pas de stack trace
    }
  });

  test("AI_RATE_LIMIT_MAX est ignoré en production (plafond par défaut conservé)", async () => {
    process.env.NODE_ENV = "production";
    process.env.AI_RATE_LIMIT_MAX = "1"; // tentative d'affaiblissement
    delete process.env.AI_API_KEY; // mode démo (aucun appel réseau)
    setCurrentUser(uid(9));
    const db = makeDb();
    const ctx = consumeCtx(db);

    // 2 appels successifs : la limite reste 30/h (défaut), pas 1 —
    // la surcharge de test ne peut pas affaiblir la production.
    await call(ai.analyzeText, ctx as never, { text: "a" } as never);
    await call(ai.analyzeText, ctx as never, { text: "b" } as never);
    expect(db.raw("rate_limits")[0].count).toBe(2);
  });

  test("les 4 actions IA consomment le même seau par compte (analyse de source)", () => {
    const src = readFileSync(
      join(resolve(import.meta.dir, "..", ".."), "src", "convex", "ai.ts"),
      "utf8",
    );
    // Chaque endpoint coûteux appelle assertWithinAiLimit AVANT tout travail.
    for (const name of ["ocrPhotos", "analyzeText", "generateSheet", "generateQuiz"]) {
      const block = src.slice(src.indexOf(`export const ${name} = action`));
      expect(
        block,
        `${name} doit consommer la limite avant le traitement`,
      ).toMatch(/await assertWithinAiLimit\(ctx, userId\)/);
    }
  });
});
