/**
 * StudySnap — paiements Stripe (abonnements Student / Pro).
 *
 * Toute la logique est côté serveur. Sans clé configurée (UI Keys), l'action
 * renvoie { available: false } et l'UI affiche un message « bientôt
 * disponible » — aucun impact sur le plan gratuit.
 *
 * Provisionnement automatique : dès que STRIPE_SECRET_KEY est présente, le
 * premier checkout déclenche l'action stripe:provisionStripe (module
 * provisionStripe.ts) qui crée les produits, les prix mensuels EUR et
 * l'endpoint webhook, puis mémorise la config dans stripe_config (accès
 * interne uniquement). Plus besoin de renseigner les price_… ni le whsec_….
 *
 * Variables d'environnement (toutes optionnelles, en surcharge de la config
 * auto-provisionnée) :
 *   STRIPE_SECRET_KEY       — clé secrète Stripe (requise pour provisionner)
 *   STRIPE_PRICE_STUDENT    — price_id du plan Student (surcharge)
 *   STRIPE_PRICE_PRO        — price_id du plan Pro (surcharge)
 *   STRIPE_WEBHOOK_SECRET   — secret du webhook /stripe-webhook (surcharge)
 */

import { v } from "convex/values";
import { action, httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

const STRIPE_API = "https://api.stripe.com/v1";

/** POST form-urlencoded vers l'API Stripe (tableaux répétés, clés imbriquées). */
async function stripeFetch(
  path: string,
  params: Record<string, string | string[]>,
  key: string,
): Promise<Record<string, unknown>> {
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

/**
 * Crée une session de checkout d'abonnement.
 * Retourne { available: false } si Stripe n'est pas configuré.
 * Si les price_id ne sont pas renseignés, provisionne automatiquement
 * (produits, prix, webhook) au premier checkout.
 */
export const createCheckoutSession = action({
  args: {
    plan: v.union(v.literal("student"), v.literal("pro")),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { available: false as const };

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Vous devez être connecté·e.");
    const user = await ctx.runQuery(api.users.currentUser);

    let priceId =
      args.plan === "student"
        ? process.env.STRIPE_PRICE_STUDENT
        : process.env.STRIPE_PRICE_PRO;

    if (!priceId) {
      const provisioned = await ctx.runAction(api.provisionStripe.provisionStripe);
      if (provisioned.provisioned) {
        priceId =
          args.plan === "student"
            ? provisioned.config.priceStudent
            : provisioned.config.pricePro;
      }
    }

    if (!priceId) {
      throw new Error(
        `Impossible de créer le paiement (plan ${args.plan}). Configurez STRIPE_PRICE_${args.plan === "student" ? "STUDENT" : "PRO"} ou vérifiez STRIPE_SECRET_KEY.`,
      );
    }

    const session = await stripeFetch(
      "/checkout/sessions",
      {
        mode: "subscription",
        "line_items[][price]": priceId,
        "line_items[][quantity]": "1",
        customer_email: user?.email ?? "",
        success_url: `${args.origin}/settings?upgraded=1`,
        cancel_url: `${args.origin}/pricing`,
        "metadata[userId]": userId,
        "metadata[plan]": args.plan,
      },
      key,
    );
    const url = session.url;
    if (typeof url !== "string") throw new Error("Stripe : URL de checkout manquante.");
    return { available: true as const, url };
  },
});

type StripeEvent = {
  type?: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      metadata?: Record<string, string>;
      status?: string;
      current_period_end?: number;
    };
  };
};

/** Vérifie la signature HMAC-SHA256 Stripe (Web Crypto, aucun import Node). */
async function verifyStripeSignature(
  raw: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",").map((p) => p.trim());
  const tsPart = parts.find((p) => p.startsWith("t="));
  const sigPart = parts.find((p) => p.startsWith("v1="));
  if (!tsPart || !sigPart) return false;
  const timestamp = tsPart.slice(2);
  const signed = `${timestamp}.${raw}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(signed));
  const expectedHex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const received = sigPart.slice(3);
  return expectedHex.length === received.length && expectedHex === received;
}

/** Webhook Stripe : met à jour l'abonnement local (session confirmée, résiliation…). */
export const stripeWebhook = httpAction(async (ctx, request) => {
  // Secret issu de la config auto-provisionnée si l'env n'est pas renseignée.
  let secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    const config = await ctx.runQuery(internal.stripeConfig.getStripeConfig);
    secret = config?.webhookSecret;
  }
  if (!secret) {
    return new Response("Webhook non configuré", { status: 200 });
  }
  const signature = request.headers.get("stripe-signature") ?? "";
  const raw = await request.text();

  const ok = await verifyStripeSignature(raw, signature, secret);
  if (!ok) return new Response("Signature invalide", { status: 400 });

  const event = JSON.parse(raw) as StripeEvent;
  const object = event.data?.object;
  if (!object) return new Response("OK", { status: 200 });

  switch (event.type) {
    case "checkout.session.completed": {
      const plan = (object.metadata?.plan as "student" | "pro") ?? "student";
      const metadataUserId = object.metadata?.userId;
      if (metadataUserId) {
        await ctx.runMutation(internal.subscriptions.upsertSubscription, {
          userId: metadataUserId,
          plan,
          status: "active",
          customerId: object.customer,
          subscriptionId: object.id,
          periodEnd: object.current_period_end,
        });
      }
      break;
    }
    case "customer.subscription.deleted": {
      if (object.customer) {
        await ctx.runMutation(internal.subscriptions.cancelSubscription, {
          customerId: object.customer,
        });
      }
      break;
    }
    default:
      break;
  }
  return new Response("OK", { status: 200 });
});
