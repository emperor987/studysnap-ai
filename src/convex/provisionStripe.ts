/**
 * StudySnap — provisionnement automatique Stripe.
 *
 * Crée (une seule fois) via l'API Stripe : les produits « Student » et
 * « Student Pro », leurs prix mensuels récurrents en euros, et l'endpoint
 * webhook {SITE_URL}/stripe-webhook. Le résultat (price_id + secret du
 * webhook) est mémorisé dans la table stripe_config via des fonctions
 * internes (jamais exposées au client).
 *
 * Idempotent : les prix sont retrouvés par lookup_key et la config déjà
 * enregistrée est réutilisée telle quelle.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { StripeConfig } from "./stripeConfig";

const STRIPE_API = "https://api.stripe.com/v1";

/** Résultat du provisionnement (annoté explicitement pour éviter un cycle d'inférence TS). */
export type ProvisionResult =
  | { provisioned: false; reason: string }
  | { provisioned: true; config: StripeConfig; reused: boolean };

async function stripeFetch(
  path: string,
  params: Record<string, string | string[]>,
  key: string,
): Promise<Record<string, unknown>> {
  // Stripe s'attend à des paramètres form : clés imbriquées (product_data[x])
  // et tableaux répétés (enabled_events=A&enabled_events=B).
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (Array.isArray(val)) {
      val.forEach((v) => body.append(k, v));
    } else {
      body.append(k, val);
    }
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

async function stripeGet(
  path: string,
  key: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

const STUDENT_LOOKUP = "studysnap_student_monthly";
const PRO_LOOKUP = "studysnap_pro_monthly";
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
];

export const provisionStripe = action({
  args: {},
  handler: async (ctx): Promise<ProvisionResult> => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return {
        provisioned: false as const,
        reason: "STRIPE_SECRET_KEY manquante (à renseigner dans l'UI Keys)",
      };
    }

    const existing = await ctx.runQuery(internal.stripeConfig.getStripeConfig);
    if (existing) {
      return { provisioned: true as const, config: existing, reused: true as const };
    }

    // Récupère les prix déjà créés (idempotence si une tentative précédente
    // a échoué après la création des prix). Stripe attend les paramètres de
    // tableau répétés : lookup_keys[]=A&lookup_keys[]=B.
    const lookupParams = new URLSearchParams();
    lookupParams.append("lookup_keys[]", STUDENT_LOOKUP);
    lookupParams.append("lookup_keys[]", PRO_LOOKUP);
    lookupParams.append("active", "true");
    lookupParams.append("limit", "10");
    const lookup = (await stripeGet(
      `/prices?${lookupParams.toString()}`,
      key,
    )) as { data?: { id: string; lookup_key?: string }[] };
    const prices = lookup.data ?? [];
    const existingPrice = (lk: string) =>
      prices.find((p) => p.lookup_key === lk)?.id;

    let priceStudent = existingPrice(STUDENT_LOOKUP);
    if (!priceStudent) {
      const res = await stripeFetch(
        "/prices",
        {
          currency: "eur",
          unit_amount: "999",
          "recurring[interval]": "month",
          lookup_key: STUDENT_LOOKUP,
          "product_data[name]": "Student",
          "product_data[metadata][studysnap_plan]": "student",
        },
        key,
      );
      priceStudent = String(res.id ?? "");
    }

    let pricePro = existingPrice(PRO_LOOKUP);
    if (!pricePro) {
      const res = await stripeFetch(
        "/prices",
        {
          currency: "eur",
          unit_amount: "1499",
          "recurring[interval]": "month",
          lookup_key: PRO_LOOKUP,
          "product_data[name]": "Student Pro",
          "product_data[metadata][studysnap_plan]": "pro",
        },
        key,
      );
      pricePro = String(res.id ?? "");
    }

    const siteUrl = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL ?? "";
    if (!siteUrl) {
      throw new Error("SITE_URL manquante — impossible de créer le webhook.");
    }

    const webhookRes = await stripeFetch(
      "/webhook_endpoints",
      {
        url: `${siteUrl}/stripe-webhook`,
        "enabled_events[]": WEBHOOK_EVENTS,
      },
      key,
    );

    const config = {
      priceStudent,
      pricePro,
      webhookId: String(webhookRes.id ?? ""),
      webhookSecret: String(webhookRes.secret ?? ""),
    };
    await ctx.runMutation(internal.stripeConfig.storeStripeConfig, config);

    return { provisioned: true as const, config, reused: false as const };
  },
});
