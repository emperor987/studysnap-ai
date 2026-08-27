/**
 * StudySnap — provisionnement automatique Stripe (crédits à l'unité).
 *
 * Crée via l'API Stripe : les 3 produits "crédits StudySnap" avec prix uniques,
 * et l'endpoint webhook {SITE_URL}/stripe-webhook. Résultat mémorisé dans
 * stripe_config via fonctions internes.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeFetch(
  path: string,
  params: Record<string, string | string[]>,
  key: string,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (Array.isArray(val)) val.forEach((v) => body.append(k, v));
    else body.append(k, val);
  }
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

async function stripeGet(path: string, key: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Stripe GET ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

const PACKS = [
  { key: "decouverte", name: "StudySnap — 5 crédits", credits: 5, amount: 199, lookupKey: "studysnap-credits-5" },
  { key: "standard", name: "StudySnap — 15 crédits", credits: 15, amount: 499, lookupKey: "studysnap-credits-15" },
  { key: "grosBesoin", name: "StudySnap — 40 crédits", credits: 40, amount: 999, lookupKey: "studysnap-credits-40" },
] as const;

/** Result type for provisioning. */
export type ProvisionResult =
  | { provisioned: false }
  | { provisioned: true; reused: boolean; config: Record<string, string> };

/** Provisionne les 3 produits/prix uniques + webhook. */
export const provisionCreditProducts = action({
  args: {},
  handler: async (ctx): Promise<ProvisionResult> => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { provisioned: false };

    const existing = await ctx.runQuery(internal.credits.findStripeConfig);
    if (existing) {
      // Vérifier que les 3 prix existent
      if (existing.priceDecouverte && existing.priceStandard && existing.priceGrosBesoin) {
        return { provisioned: true, reused: true, config: existing as unknown as Record<string, string> };
      }
    }

    // Récupérer ou créer le compte
    const account = await stripeGet("/account", key);
    const accountId = account.id as string;
    const mode = (account as Record<string, unknown>).charges_enabled ? "live" : "test";

    // Créer les 3 produits + prix
    const priceIds: Record<string, string> = {};
    for (const pack of PACKS) {
      const product = await stripeFetch("/products", {
        name: pack.name,
        "metadata[credits]": String(pack.credits),
        "metadata[type]": "credit_pack",
      }, key);

      const price = await stripeFetch("/prices", {
        product: product.id as string,
        unit_amount: String(pack.amount),
        currency: "eur",
        "metadata[credits]": String(pack.credits),
      }, key);

      priceIds[`price${pack.key.charAt(0).toUpperCase() + pack.key.slice(1)}`] = price.id as string;
    }

    // Créer ou récupérer le webhook endpoint
    let webhookId: string;
    let webhookSecret: string;

    if (existing?.webhookId) {
      webhookId = existing.webhookId;
      webhookSecret = existing.webhookSecret;
    } else {
      const origin = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
      const siteUrl = origin.replace(/\/$/, "");
      const webhook = await stripeFetch("/webhook_endpoints", {
        url: `${siteUrl}/stripe-webhook`,
        "enabled_events[]": "checkout.session.completed",
      }, key);
      webhookId = webhook.id as string;
      webhookSecret = (webhook as Record<string, Record<string, string>>).secret?.signing_secret ?? "";
    }

    // Sauvegarder la config
    const config = {
      singleton: "default" as const,
      accountId,
      mode,
      priceDecouverte: priceIds.priceDecouverte,
      priceStandard: priceIds.priceStandard,
      priceGrosBesoin: priceIds.priceGrosBesoin,
      webhookId,
      webhookSecret,
      updatedAt: Date.now(),
    };

    await ctx.runMutation(internal.credits.upsertConfig, config as any);

    return { provisioned: true, reused: false, config: config as unknown as Record<string, string> };
  },
});

/**
 * Legacy export — used by tests. Delegates to provisionCreditProducts.
 */
export const provisionStripe = provisionCreditProducts;
