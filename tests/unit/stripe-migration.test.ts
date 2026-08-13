/**
 * Tests de migration — changement de compte Stripe StudySnap.
 *
 * 1. Provisionnement : la config est empreintée par l'ID du compte (acct_...).
 *    Un changement de clé (nouveau compte, même mode test/test ou live/live)
 *    déclenche un RE-provisionnement complet : produits, prix (montants
 *    exacts 4,99 / 49,99 / 6,99 / 69,99 €), endpoint webhook et son secret.
 * 2. Webhook : les 4 événements requis sont abonnés ; le handler gère
 *    checkout.session.completed, customer.subscription.updated,
 *    customer.subscription.deleted et invoice.payment_failed (échec de
 *    paiement → statut past_due, l'accès payant est retiré côté app).
 * 3. Sécurité : validation de signature conservée (aucun secret réel,
 *    fixtures locales, fetch mocké).
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { provisionStripe, type ProvisionResult } from "@/convex/provisionStripe";
import type { StripeConfig } from "@/convex/stripeConfig";
import { stripeWebhook } from "@/convex/stripe";

const ROOT = resolve(import.meta.dir, "..", "..");

/* ------------------------------------------------------------------ */
/* Fixtures / helpers                                                  */
/* ------------------------------------------------------------------ */

const ACCOUNT_NEW = "acct_test_NEW";
const ACCOUNT_OLD = "acct_test_OLD";
const WEBHOOK_SECRET = "whsec_test_migration_fixture";

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Contexte d'action simulé : config striée lue/écrite en mémoire. */
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

/** Mock de l'API Stripe : compte, prix (créés au POST) et webhook. */
function mockStripeApi(accountId: string) {
  const state = { priceCounter: 0, webhookCounter: 0, calls: [] as Array<{ url: string; body: URLSearchParams }> };
  const originalFetch = globalThis.fetch;
  (globalThis as { fetch: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    state.calls.push({ url, body: new URLSearchParams(String(init?.body ?? "")) });
    const method = init?.method ?? "GET";
    if (url.endsWith("/v1/account")) return jsonResponse({ id: accountId });
    if (url.includes("/v1/prices")) {
      if (method === "GET") return jsonResponse({ data: [] });
      state.priceCounter += 1;
      return jsonResponse({ id: `price_test_${state.priceCounter}` });
    }
    if (url.endsWith("/v1/webhook_endpoints")) {
      state.webhookCounter += 1;
      return jsonResponse({
        id: `we_test_${state.webhookCounter}`,
        secret: `whsec_test_${state.webhookCounter}`,
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
      priceStudent: "price_student",
      pricePro: "price_pro",
    }),
    runMutation: async (fn: unknown, args: unknown) => {
      mutations.push({ fn, args });
    },
  };
}

async function callWebhook(body: string, signature: string) {
  const ctx = webhookCtx();
  // httpAction expose le handler brut sous `_handler`.
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
/* 1. Provisionnement — migration de compte Stripe                     */
/* ------------------------------------------------------------------ */

describe("provisionStripe — migration de compte Stripe", () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  const originalSiteUrl = process.env.SITE_URL;
  let fetchRestore: (() => void) | null = null;

  beforeEach(() => {
    // Nécessaire pour la création de l'endpoint webhook ({SITE_URL}/stripe-webhook).
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

  test("premier provisionnement : crée les 4 prix aux bons montants + webhook, empreinte le compte", async () => {
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
    // 4 prix (Student mensuel 499, Pro mensuel 699, Student annuel 4999,
    // Pro annuel 6999) + 1 webhook.
    expect(state.priceCounter).toBe(4);
    expect(state.webhookCounter).toBe(1);
    expect(res.config.webhookSecret).toMatch(/^whsec_test_/);

    // Le montant en centimes et la période sont bien ceux des plans StudySnap.
    const pricePosts = state.calls.filter((c) => c.url.endsWith("/v1/prices"));
    const amounts = pricePosts.map((c) => c.body.get("unit_amount")).sort();
    expect(amounts).toEqual(["499", "4999", "699", "6999"]);

    // L'endpoint webhook est créé sur la même URL backend et reçoit les 4
    // événements requis (dont invoice.payment_failed).
    const webhookPost = state.calls.find((c) =>
      c.url.endsWith("/v1/webhook_endpoints"),
    );
    expect(webhookPost?.body.get("url")).toContain("/stripe-webhook");
    const events = webhookPost?.body.getAll("enabled_events[]") ?? [];
    expect(events).toEqual(
      expect.arrayContaining([
        "checkout.session.completed",
        "customer.subscription.updated",
        "customer.subscription.deleted",
        "invoice.payment_failed",
      ]),
    );

    // La config (price_id + secret du webhook) est stockée côté serveur.
    expect(ctx.calls.stored).toHaveLength(1);
    const stored = ctx.calls.stored[0] as { accountId: string };
    expect(stored.accountId).toBe(ACCOUNT_NEW);
  });

  test("même compte → la config existante est réutilisée (idempotent)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_migration_fixture";
    const { state, restore } = mockStripeApi(ACCOUNT_NEW);
    fetchRestore = restore;
    const existing = {
      accountId: ACCOUNT_NEW,
      mode: "test" as const,
      priceStudent: "price_student",
      pricePro: "price_pro",
      priceStudentAnnual: "price_student_annual",
      priceProAnnual: "price_pro_annual",
      webhookId: "we_test_1",
      webhookSecret: "whsec_test_1",
    };
    const ctx = provisionCtx(existing);

    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: true }>;

    expect(res.reused).toBe(true);
    expect(res.config.priceStudent).toBe("price_student");
    // Aucun objet recréé côté Stripe, aucune nouvelle config stockée.
    expect(state.priceCounter).toBe(0);
    expect(state.webhookCounter).toBe(0);
    expect(ctx.calls.stored).toHaveLength(0);
  });

  test("CHANGEMENT DE COMPTE (même mode test) → re-provisionnement complet", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_migration_fixture";
    const { state, restore } = mockStripeApi(ACCOUNT_NEW);
    fetchRestore = restore;
    // Config de l'ANCIEN compte : mêmes prix mensuels/annuels mais compte
    // différent (acct_test_OLD) — c'est exactement la situation après
    // remplacement de la clé dans l'UI Keys.
    const stale = {
      accountId: ACCOUNT_OLD,
      mode: "test" as const,
      priceStudent: "price_old_student",
      pricePro: "price_old_pro",
      priceStudentAnnual: "price_old_student_annual",
      priceProAnnual: "price_old_pro_annual",
      webhookId: "we_old_1",
      webhookSecret: "whsec_old_1",
    };
    const ctx = provisionCtx(stale);

    const res = (await (provisionStripe as unknown as {
      _handler: (c: unknown, a: unknown) => Promise<ProvisionResult>;
    })._handler(ctx, {})) as Extract<ProvisionResult, { provisioned: true }>;

    // Tout est recréé sous le NOUVEAU compte : 4 prix + 1 webhook, et la
    // nouvelle config remplace l'ancienne (nouveau price_id, nouveau secret).
    expect(res.reused).toBe(false);
    expect(res.config.accountId).toBe(ACCOUNT_NEW);
    expect(res.config.priceStudent).not.toBe("price_old_student");
    expect(res.config.webhookSecret).toMatch(/^whsec_test_/);
    expect(state.priceCounter).toBe(4);
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
/* 2. Webhook — événements requis et gestion des échecs de paiement     */
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

  test("invoice.payment_failed → abonnement passé en past_due (accès payant retiré)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_inv_1",
      type: "invoice.payment_failed",
      data: { object: { id: "in_1", customer: "cus_test_123", subscription: "sub_test_123" } },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);

    expect(res.status).toBe(200);
    expect(ctx.mutations).toHaveLength(1);
    // Seule syncSubscriptionStatus (webhook interne) accepte customerId+status
    // sans userId — la requête correspond à la gestion d'échec de paiement.
    expect(ctx.mutations[0].args).toEqual({
      customerId: "cus_test_123",
      status: "past_due",
    });
  });

  test("customer.subscription.updated (actif) → statut synchronisé sans dégrader", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_sub_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_test_123",
          customer: "cus_test_123",
          status: "active",
          current_period_end: 1_700_000_000,
        },
      },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);

    expect(res.status).toBe(200);
    expect(ctx.mutations[0].args).toEqual({
      customerId: "cus_test_123",
      status: "active",
      periodEnd: 1_700_000_000,
      subscriptionId: "sub_test_123",
    });
  });

  test("customer.subscription.updated (annulé) → statut brut conservé", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_sub_2",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_2", customer: "cus_test_2", status: "canceled" } },
    });
    const sig = await buildSignature(body, WEBHOOK_SECRET, Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);
    expect(res.status).toBe(200);
    expect((ctx.mutations[0].args as { status: string }).status).toBe("canceled");
  });

  test("signature invalide → 400 et AUCUNE mutation (la sécurité tient)", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
    const body = JSON.stringify({
      id: "evt_fake",
      type: "checkout.session.completed",
      data: { object: { id: "cs_fake", metadata: { plan: "student", userId: "users-1" } } },
    });
    const sig = await buildSignature(body, "whsec_WRONG", Math.floor(Date.now() / 1000));
    const { res, ctx } = await callWebhook(body, sig);
    expect(res.status).toBe(400);
    expect(ctx.mutations).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Source — événements abonnés par le provisionnement                */
/* ------------------------------------------------------------------ */

describe("provisionStripe — source : les 4 événements du webhook sont abonnés", () => {
  test("WEBHOOK_EVENTS contient checkout + subscriptions + invoice.payment_failed", () => {
    const src = readFileSync(join(ROOT, "src/convex/provisionStripe.ts"), "utf8");
    for (const evt of [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
    ]) {
      expect(src).toContain(evt);
    }
  });

  test("aucun prix en dur : les montants des plans vivent dans les lookup_keys/amounts du provisionnement", () => {
    const src = readFileSync(join(ROOT, "src/convex/provisionStripe.ts"), "utf8");
    // Montants exacts des plans StudySnap en centimes (4,99 € / 49,99 € /
    // 6,99 € / 69,99 €) — la seule source de vérité des prix.
    expect(src).toContain('"499"');
    expect(src).toContain('"699"');
    expect(src).toContain('"4999"');
    expect(src).toContain('"6999"');
  });
});
