/**
 * StudySnap — provisionnement automatique Stripe.
 *
 * Crée (une seule fois) via l'API Stripe : les produits « Student » et
 * « Student Pro », leurs prix récurrents en euros (mensuel + annuel), et
 * l'endpoint webhook {SITE_URL}/stripe-webhook. Le résultat (price_id +
 * secret du webhook) est mémorisé dans la table stripe_config via des
 * fonctions internes (jamais exposées au client).
 *
 * Tarifs : Student 4,99 €/mois ou 49,99 €/an — Student Pro 6,99 €/mois ou
 * 69,99 €/an (≈ 2 mois offerts en annuel).
 *
 * Idempotent : les prix sont retrouvés par lookup_key. Les anciens prix
 * (9,99/14,99 € mensuels) utilisent d'autres lookup_keys : les nouveaux
 * lookup_keys v2 forcent la création des prix aux nouveaux montants.
 * Si la config enregistrée date d'avant les prix annuels, on re-provisionne.
 *
 * MIGRATION DE COMPTE STRIPE : la config est empreintée par l'ID du compte
 * associé à la clé (GET /v1/account → acct_...). Si l'ID change (nouvelle
 * clé d'un AUTRE compte Stripe, même mode test/test ou live/live), tout est
 * recréé sous le nouveau compte : produits, prix (lookup_keys propres au
 * nouveau compte), endpoint webhook (même URL {SITE_URL}/stripe-webhook) et
 * son secret de signature. Aucun price_id / whsec de l'ancien compte n'est
 * réutilisé.
 */

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { StripeConfig } from "./stripeConfig";

const STRIPE_API = "https://api.stripe.com/v1";

/** Résultat du provisionnement (annoté explicitement pour éviter un cycle d'inférence TS). */
export type ProvisionResult =
  | { provisioned: false; reason: string }
  | {
      provisioned: true;
      config: StripeConfig;
      reused: boolean;
      mode: "test" | "live";
    };

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

const STUDENT_LOOKUP = "studysnap_student_monthly_v2";
const PRO_LOOKUP = "studysnap_pro_monthly_v2";
const STUDENT_ANNUAL_LOOKUP = "studysnap_student_annual";
const PRO_ANNUAL_LOOKUP = "studysnap_pro_annual";
const WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
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

    // Les objets Stripe (produits, prix, webhook) sont propres à chaque
    // environnement ET à chaque compte : une config enregistrée en test ne
    // vaut pas en live, et une config d'un AUTRE compte (migration) non plus.
    const mode: "test" | "live" = key.startsWith("sk_live_") ? "live" : "test";

    // Empreinte du compte associé à la clé : détecte un changement de compte
    // même dans le même mode (ex. ancien compte test → nouveau compte test).
    const account = (await stripeGet("/account", key)) as { id?: string };
    const accountId = String(account.id ?? "");
    if (!accountId) {
      throw new Error("Stripe : impossible de lire l'identifiant du compte.");
    }

    const existing = await ctx.runQuery(internal.stripeConfig.getStripeConfig);
    // Re-provisionne si : autre environnement, AUTRE COMPTE (accountId
    // différent), ou config datant d'avant les prix annuels (champs manquants).
    if (
      existing &&
      existing.mode === mode &&
      existing.accountId === accountId &&
      existing.priceStudentAnnual &&
      existing.priceProAnnual
    ) {
      return {
        provisioned: true as const,
        config: existing,
        reused: true as const,
        mode,
      };
    }

    // Récupère les prix déjà créés (idempotence si une tentative précédente
    // a échoué après la création des prix). Stripe attend les paramètres de
    // tableau répétés : lookup_keys[]=A&lookup_keys[]=B.
    const lookupParams = new URLSearchParams();
    lookupParams.append("lookup_keys[]", STUDENT_LOOKUP);
    lookupParams.append("lookup_keys[]", PRO_LOOKUP);
    lookupParams.append("lookup_keys[]", STUDENT_ANNUAL_LOOKUP);
    lookupParams.append("lookup_keys[]", PRO_ANNUAL_LOOKUP);
    lookupParams.append("active", "true");
    lookupParams.append("limit", "20");
    const lookup = (await stripeGet(
      `/prices?${lookupParams.toString()}`,
      key,
    )) as { data?: { id: string; lookup_key?: string }[] };
    const prices = lookup.data ?? [];
    const existingPrice = (lk: string) =>
      prices.find((p) => p.lookup_key === lk)?.id;

    const getOrCreate = async (
      lookupKey: string,
      unitAmount: string,
      interval: "month" | "year",
      name: string,
      plan: string,
    ): Promise<string> => {
      const found = existingPrice(lookupKey);
      if (found) return found;
      const res = await stripeFetch(
        "/prices",
        {
          currency: "eur",
          unit_amount: unitAmount,
          "recurring[interval]": interval,
          lookup_key: lookupKey,
          "product_data[name]": name,
          "product_data[metadata][studysnap_plan]": plan,
        },
        key,
      );
      return String(res.id ?? "");
    };

    const priceStudent = await getOrCreate(
      STUDENT_LOOKUP,
      "499",
      "month",
      "Student",
      "student",
    );
    const pricePro = await getOrCreate(
      PRO_LOOKUP,
      "699",
      "month",
      "Student Pro",
      "pro",
    );
    const priceStudentAnnual = await getOrCreate(
      STUDENT_ANNUAL_LOOKUP,
      "4999",
      "year",
      "Student",
      "student",
    );
    const priceProAnnual = await getOrCreate(
      PRO_ANNUAL_LOOKUP,
      "6999",
      "year",
      "Student Pro",
      "pro",
    );

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
      accountId,
      mode,
      priceStudent,
      pricePro,
      priceStudentAnnual,
      priceProAnnual,
      webhookId: String(webhookRes.id ?? ""),
      webhookSecret: String(webhookRes.secret ?? ""),
    };
    await ctx.runMutation(internal.stripeConfig.storeStripeConfig, config);

    return { provisioned: true as const, config, reused: false as const, mode };
  },
});
