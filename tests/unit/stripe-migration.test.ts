/**
 * Tests — provisionnement et webhook StudySnap (crédits à l'unité).
 *
 * 1. Provisionnement : crée 3 produits/prix (Découverte 199c, Standard 499c,
 *    Gros Besoin 999c) + 1 webhook endpoint. Config mémorisée dans stripe_config.
 *    Un 2e appel réutilise la config existante (idempotent).
 * 2. Webhook : gère checkout.session.completed pour créditer l'utilisateur.
 * 3. Sécurité : validation de signature HMAC-SHA256.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";

import { provisionStripe, type ProvisionResult } from "@/convex/provisionStripe";
import type { StripeConfig } from "@/convex/stripeConfig";
import { stripeWebhook } from "@/convex/stripe";

/* ------------------------------------------------------------------ */
/* Fixtures / helpers                                                  */
/* ------------------------------------------------------------------ */

const ACCOUNT_NEW = "acct_test_NEW";
const WEBHOOK_SECRET = "whsec_test_migration_fixture";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Contexte d'action simulé : config lue/écrite en mémoire. */
function provisionCtx(stored: StripeConfig | null) {
  const calls = { stored: [] as unknown[], priceBodies: [] as string[] };
  return {
    calls,
    runQuery: async () => stored,
    runMutation: async (_fn: unknown, args: unknown) => {
      calls.stored.push(args);
    },
  };
}

/** Mock de l'API Stripe : compte, produits, prix et webhook. */
function mockStripeApi(accountId: string) {
  const state = {
    productCounter: 0,
    priceCounter: 0,
    webhookCounter: 0,
    calls: [] as Array<{ url: string; body: URLSearchParams }>,
  };
  const originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    state.calls.push({ url, body: new URLSearchParams(String(init?.body ?? "")) });
    const method = init?.method ?? "GET";
    if (url.endsWith("/v1/account")) return jsonResponse({ id: accountId });
    if (url.endsWith("/v1/products") && method === "POST") {
      state.productCounter += 1;
      return jsonResponse({ id: `prod_test_${state.productCounter}` });
    }
    if (url.includes("/v1/prices")) {
      if (method === "GET") return jsonResponse({ data: [] });
      state.priceCounter += 1;
      return jsonResponse({ id: `price_test_${state.priceCounter}` });
    }
    if (url.endsWith("/v1/webhook_endpoints")) {
      state.webhookCounter += 1;
      return jsonResponse({
        id: `we_test_${state.webhookCounter}`,
        secret: { signing_secret: `whsec_test_${state.webhookCounter}` },
      });
    }
    throw new Error(`Appel Stripe non simulé : ${url}`);
  }) as typeof fetch;
  return { state, restore: () => { globalThis.fetch = originalFetch; } };
}

/** Signature Stripe valide (HMAC-SHA256, Web Crypto — fixture locale). */
async function buildSignature(body: string, secret: string, timestampSec: number) {
  const signed = `${timestampSec}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signed));
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `t=${timestampSec},v1=${hex}`;
}

/** Contexte http simulé pour le handler du webhook. */
function webhookCtx() {
  const mutations: Array<{ fn: unknown; args: unknown }> = [];
  return {
    mutations,
    runQuery: async () => ({
      accountId: ACCOUNT_NEW,
      mode: "test" as const,
      webhookSecret: WEBHOOK_SECRET,
      priceDecouverte: "price_decouverte",
      priceStandard: "price_standard",
      priceGrosBesoin: "price_gros_besoin",
    }),
    runMutation: async (fn: unknown, args: unknown) => {
      mutations.push({ fn, args });
    },
  };
}

async function callWebhook(body: string, signature: string) {
  const ctx = webhookCtx();
  const handler = (
    stripeWebhook as unknown as {
      _handler: (c: unknown, r: unknown) => Promise<Response>;
    }
  )._handler;
  const res = await handler(
    ctx,
    new Request("https://app.example/stripe-webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body,
    }),
  );
  return { res, ctx };
}

/* ------------------------------------------------------------------ */
/* 1. Provisionnement — création des produits crédits                   */
/* ------------------------------------------------------------------ */

describe("provisionStripe — produits crédits StudySnap", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSiteUrl = process.env.SITE_URL;
  let fetchRestore: (() => void) | null = null;

  beforeEach(() => {
    process.env.SITE_URL = "https://studysnap.app";
  });

  afterEach(() => {
    fetchRestore?.();
    fetchRestore = null;
    vi.restoreAllMocks();
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
    if (originalSiteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = originalSiteUrl;
  });

  test("premier provisionnement : crée 3 produits + 3 prix + 1 webhook", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_migration_fixture";
    const { state, restore } = mockStripeApi(ACCOUNT_NEW);
    fetchRestore = restore;
    const ctx = provisionCtx(null);

    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: true }>;

    expect(res.provisioned).toBe(true);
    expect(res.reused).toBe(false);
    expect(res.config.accountId).toBe(ACCOUNT_NEW);
    expect(res.config.mode).toBe("test");
    // 3 produits + 3 prix + 1 webhook.
    expect(state.productCounter).toBe(3);
    expect(state.priceCounter).toBe(3);
    expect(state.webhookCounter).toBe(1);

    // Les montants en centimes correspondent aux packs StudySnap.
    const amounts = state.calls
      .filter((c) => c.url.includes("/v1/prices") && c.body.has("unit_amount"))
      .map((c) => c.body.get("unit_amount"))
      .sort();
    expect(amounts).toEqual(["199", "499", "999"]);

    // L'endpoint webhook est créé sur la même URL backend.
    const webhookPost = state.calls.find((c) =>
      c.url.endsWith("/v1/webhook_endpoints"),
    );
    expect(webhookPost?.body.get("url")).toContain("/stripe-webhook");

    // La config est stockée côté serveur.
    expect(ctx.calls.stored).toHaveLength(1);
    const stored = ctx.calls.stored[0] as { accountId: string };
    expect(stored.accountId).toBe(ACCOUNT_NEW);
  });

  test("même compte avec config complète → réutilisée (idempotent)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_migration_fixture";
    const { state, restore } = mockStripeApi(ACCOUNT_NEW);
    fetchRestore = restore;
    const existing: StripeConfig = {
      accountId: ACCOUNT_NEW,
      mode: "test",
      priceDecouverte: "price_decouverte",
      priceStandard: "price_standard",
      priceGrosBesoin: "price_gros_besoin",
      webhookId: "we_test_1",
      webhookSecret: "whsec_test_1",
    };
    const ctx = provisionCtx(existing);

    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: true }>;

    expect(res.reused).toBe(true);
    expect(res.config.priceDecouverte).toBe("price_decouverte");
    // Aucun objet recréé côté Stripe, aucune nouvelle config stockée.
    expect(state.priceCounter).toBe(0);
    expect(state.webhookCounter).toBe(0);
    expect(ctx.calls.stored).toHaveLength(0);
  });

  test("config sans prix → re-provisionnement complet", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_migration_fixture";
    const { state, restore } = mockStripeApi(ACCOUNT_NEW);
    fetchRestore = restore;
    // Config partielle : accountId existe mais prix manquants
    const stale: StripeConfig = {
      accountId: "acct_test_OLD",
      mode: "test",
      priceDecouverte: "",
      priceStandard: "",
      priceGrosBesoin: "",
      webhookId: "",
      webhookSecret: "",
    };
    const ctx = provisionCtx(stale);

    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: true }>;

    // Tout est recréé : 3 produits + 3 prix + 1 webhook.
    expect(res.reused).toBe(false);
    expect(res.config.accountId).toBe(ACCOUNT_NEW);
    expect(res.config.priceDecouverte).not.toBe("");
    expect(state.productCounter).toBe(3);
    expect(state.priceCounter).toBe(3);
    expect(state.webhookCounter).toBe(1);
    expect(ctx.calls.stored).toHaveLength(1);
    expect((ctx.calls.stored[0] as { accountId: string }).accountId).toBe(
      ACCOUNT_NEW,
    );
  });

  test("sans STRIPE_SECRET_KEY → disponible:false, aucune erreur", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const ctx = provisionCtx(null);
    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: false }>;
    expect(res.provisioned).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Webhook — checkout.session.completed crédite l'utilisateur        */
/* ------------------------------------------------------------------ */

describe("stripeWebhook — événements après migration", () => {
  const origSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const origPrevious = process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;

  afterEach(() => {
    if (origSecret === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
    else process.env.STRIPE_WEBHOOK_SECRET = origSecret;
    if (origPrevious === undefined) delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    else process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS = origPrevious;
  });

  test("checkout.session.completed → crédite l'utilisateur (5 crédits)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_cs_1",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          metadata: {
            userId: "users-1",
            packId: "decouverte",
            credits: "5",
            amountEur: "199",
          },
        },
      },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);

    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(1);
    expect(ctx.mutations[0].args).toMatchObject({
      userId: "users-1",
      packId: "decouverte",
      credits: 5,
      amountEur: 199,
    });
  });

  test("checkout.session.completed (Standard) → 15 crédits", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_cs_2",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_2",
          metadata: {
            userId: "users-2",
            packId: "standard",
            credits: "15",
            amountEur: "499",
          },
        },
      },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);

    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(1);
    expect(ctx.mutations[0].args).toMatchObject({
      userId: "users-2",
      packId: "standard",
      credits: 15,
    });
  });

  test("checkout.session.completed (Gros Besoin) → 40 crédits", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_cs_3",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_3",
          metadata: {
            userId: "users-3",
            packId: "grosBesoin",
            credits: "40",
            amountEur: "999",
          },
        },
      },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);

    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(1);
    expect(ctx.mutations[0].args).toMatchObject({
      userId: "users-3",
      packId: "grosBesoin",
      credits: 40,
    });
  });

  test("evenement inconnu → 200 OK sans mutation", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_unknown",
      type: "some.unknown.event",
      data: { object: {} },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);
    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(0);
  });

  test("checkout sans metadata userId → 200 OK sans mutation (pas de crash)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_cs_nometa",
      type: "checkout.session.completed",
      data: { object: { id: "cs_nometa", metadata: {} } },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);
    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Source — vérifie le code source du provisionnement                */
/* ------------------------------------------------------------------ */

describe("provisionStripe — source : code du provisionnement", () => {
  test("WEBHOOK_EVENTS contient checkout.session.completed", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const ROOT = resolve(import.meta.dir, "..", "..");
    const src = readFileSync(join(ROOT, "src/convex/provisionStripe.ts"), "utf8");
    expect(src).toContain("checkout.session.completed");
  });

  test("les montants des packs vivent dans les amounts du provisionnement", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, resolve } = await import("node:path");
    const ROOT = resolve(import.meta.dir, "..", "..");
    const src = readFileSync(join(ROOT, "src/convex/provisionStripe.ts"), "utf8");
    // Montants exacts des packs StudySnap en centimes (1,99 € / 4,99 € / 9,99 €)
    expect(src).toContain("amount: 199");
    expect(src).toContain("amount: 499");
    expect(src).toContain("amount: 999");
  });
});
