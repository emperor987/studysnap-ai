/**
 * Tests de sécurité — Surveillance et journal d'abus :
 *
 * 1. Endpoint public /health : réponse 200 JSON, aucune donnée interne
 *    (pas de nom de variable d'environnement, pas de clé, pas de version),
 *    enregistré dans http.ts.
 * 2. Journal security_events : un refus de rate limit est journalisé
 *    (bucket + type corrects), une requête autorisée ne l'est pas, pas de
 *    doublon dans la même fenêtre, purge des lignes anciennes uniquement.
 *
 * Aucun backend déployé : contexte simulé + handlers appelés directement.
 */
import { afterEach, describe, expect, test, vi } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as health from "@/convex/health";
import * as rateLimit from "@/convex/rateLimit";
import * as securityEvents from "@/convex/securityEvents";

import { call, makeDb, makeMutationCtx } from "../helpers/mock-convex";

// Horloge simulée : les étapes d'un même test s'exécutent en quelques
// microsecondes — sans elle, deux fenêtres consécutives partagent la même
// milliseconde et la déduplication du journal ne peut pas les distinguer.
// On pilote Date.now (utilisé par le rate limiter et le journal) via un spy.
afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Endpoint /health                                                  */
/* ------------------------------------------------------------------ */

describe("/health — contrôle santé public", () => {
  test("répond 200 JSON avec status ok, sans fuite d'informations internes", async () => {
    const res = await call<Response>(
      health.health,
      {} as never,
      new Request("https://studysnap.example/health"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.time).toBe("number");

    const raw = JSON.stringify(body);
    for (const forbidden of ["API_KEY", "STRIPE", "CONVEX", "SECRET", "TOKEN", "version"]) {
      expect(raw.toUpperCase()).not.toContain(forbidden.toUpperCase());
    }
  });

  test("la réponse n'est pas mise en cache (no-store)", async () => {
    const res = await call<Response>(
      health.health,
      {} as never,
      new Request("https://studysnap.example/health"),
    );
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("la route /health est bien enregistrée dans http.ts", () => {
    const src = readFileSync(
      join(resolve(import.meta.dir, "..", ".."), "src", "convex", "http.ts"),
      "utf8",
    );
    expect(src).toContain('path: "/health"');
    expect(src).toContain('method: "GET"');
  });
});

/* ------------------------------------------------------------------ */
/* 2. Journal d'audit des tentatives bloquées                           */
/* ------------------------------------------------------------------ */

describe("security_events — trace des refus (anti-abus)", () => {
  test("un refus de rate limit est journalisé avec le bon type", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);

    // Plafond : 1 → le 2e appel est refusé.
    await call(rateLimit.consume, ctx as never, {
      key: "ai:users-1",
      windowMs: 60_000,
      max: 1,
    } as never);
    const blocked = await call<{ allowed: boolean }>(
      rateLimit.consume,
      ctx as never,
      { key: "ai:users-1", windowMs: 60_000, max: 1 } as never,
    );
    expect(blocked.allowed).toBe(false);

    const events = db.raw("security_events");
    expect(events).toHaveLength(1);
    expect(events[0].bucket).toBe("ai:users-1");
    expect(events[0].kind).toBe("ai_generation");
    expect(typeof events[0].deniedAt).toBe("number");
  });

  test("une requête autorisée n'écrit aucun événement", async () => {
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    await call(rateLimit.consume, ctx as never, {
      key: "ai:users-2",
      windowMs: 60_000,
      max: 5,
    } as never);
    await call(rateLimit.consume, ctx as never, {
      key: "ai:users-2",
      windowMs: 60_000,
      max: 5,
    } as never);
    expect(db.raw("security_events")).toHaveLength(0);
  });

  test("pas de doublon dans la même fenêtre (croissance bornée)", async () => {
    const t0 = 1_766_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);
    const db = makeDb();
    const ctx = makeMutationCtx(db);
    const args = { key: "otp:a@example.fr", windowMs: 60_000, max: 1 };
    await call(rateLimit.consume, ctx as never, args as never);

    // Deux refus successifs dans la même fenêtre : une seule ligne d'audit.
    await call(rateLimit.consume, ctx as never, args as never);
    await call(rateLimit.consume, ctx as never, args as never);
    const events = db.raw("security_events");
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("otp_flood");

    // Fenêtre suivante (61 s plus tard) : le seau repart, et le nouveau
    // refus est journalisé — toujours une seule ligne par fenêtre.
    nowSpy.mockReturnValue(t0 + 61_000);
    const row = db.raw("rate_limits")[0];
    db.patch("rate_limits", row._id as string, {
      windowStart: Date.now() - 61_000,
    });
    await call(rateLimit.consume, ctx as never, args as never); // reset (autorisé)
    await call(rateLimit.consume, ctx as never, args as never); // refus fenêtre 2
    const after = db.raw("security_events");
    expect(after).toHaveLength(2);
    expect(after[1].windowStart).not.toBe(after[0].windowStart);
    nowSpy.mockRestore();
  });

  test("la purge ne supprime que les événements plus anciens que la rétention", async () => {
    const t0 = 1_766_000_000_000;
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(t0);
    const db = makeDb();
    const ctx = makeMutationCtx(db);

    // Deux refus dans deux fenêtres différentes → deux lignes.
    const args = { key: "ai:users-3", windowMs: 60_000, max: 1 };
    await call(rateLimit.consume, ctx as never, args as never);
    await call(rateLimit.consume, ctx as never, args as never); // refus fenêtre 1
    nowSpy.mockReturnValue(t0 + 61_000);
    const firstRow = db.raw("rate_limits")[0];
    db.patch("rate_limits", firstRow._id as string, {
      windowStart: Date.now() - 61_000,
    });
    // Fenêtre expirée → la consommation suivante ouvre une nouvelle fenêtre
    // (autorisée, sans événement), puis le refus suivant journalise.
    await call(rateLimit.consume, ctx as never, args as never); // nouvelle fenêtre
    await call(rateLimit.consume, ctx as never, args as never); // refus fenêtre 2

    const events = db.raw("security_events");
    expect(events).toHaveLength(2);

    // Vieillit artificiellement la plus ancienne au-delà de la rétention.
    const oldest = [...events].sort(
      (a, b) => (a.deniedAt as number) - (b.deniedAt as number),
    )[0];
    db.patch("security_events", oldest._id as string, {
      deniedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });

    const res = await call<{ deleted: number }>(
      securityEvents.purgeSecurityEventsInternal,
      ctx as never,
      {} as never,
    );
    expect(res.deleted).toBe(1);
    expect(db.raw("security_events")).toHaveLength(1);
    nowSpy.mockRestore();
  });

  test("kindOfKey — typage des refus selon la cible", () => {
    expect(rateLimit.kindOfKey("otp:eleve@example.fr")).toBe("otp_flood");
    expect(rateLimit.kindOfKey("ai:users-1")).toBe("ai_generation");
    expect(rateLimit.kindOfKey("autre:xyz")).toBe("rate_limit");
  });
});
