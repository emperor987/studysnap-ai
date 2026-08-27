/**
 * StudySnap — paiements Stripe (crédits à l'unité, paiements uniques).
 *
 * Chaque achat = une session Stripe Checkout en mode "payment" (pas d'abonnement).
 * Sans clé configurée (UI Keys), l'action renvoie { available: false }.
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { resolveStripeOrigin } from "../lib/url";
import { CREDIT_PACKS, type CreditPackId } from "./schema";
import { stripeWebhook } from "./stripeWebhook";
import type { Id } from "./_generated/dataModel";
export { stripeWebhook };

// ─── Signature verification (re-exported for tests) ───

/** Vérifie la signature HMAC-SHA256 d'un webhook Stripe avec un seul secret. */
export async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  return verifyStripeSignatureAny(body, signature, [secret]);
}

/** Vérifie la signature avec une liste de secrets (rotation en chevauchement). */
export async function verifyStripeSignatureAny(
  body: string,
  signature: string,
  secrets: string[],
): Promise<boolean> {
  const tolerance = 300; // 5 min
  const parsed = parseStripeSignature(signature);
  if (!parsed || secrets.length === 0) return false;

  const ageSec = Math.abs(Date.now() / 1000 - parsed.timestamp);
  if (ageSec > tolerance) return false;

  for (const secret of secrets) {
    if (!secret) continue;
    try {
      const signed = `${parsed.timestamp}.${body}`;
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const sigBytes = hexToBytes(parsed.v1) as BufferSource;
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(signed) as BufferSource);
      if (valid) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function parseStripeSignature(header: string): { timestamp: number; v1: string } | null {
  const parts = header.split(",");
  let timestamp = 0;
  let v1 = "";
  for (const part of parts) {
    const [key, val] = part.split("=");
    if (key === "t") timestamp = parseInt(val ?? "", 10);
    if (key === "v1") v1 = val ?? "";
  }
  if (!timestamp || !v1) return null;
  return { timestamp, v1 };
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

const STRIPE_API = "https://api.stripe.com/v1";

/** POST form-urlencoded vers l'API Stripe. */
async function stripeFetch(
  path: string,
  params: Record<string, string | string[]>,
  key: string,
  idempotencyKey?: string,
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (Array.isArray(val)) {
      val.forEach((v) => body.append(k, v));
    } else {
      body.append(k, val);
    }
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

/** Crée une session de checkout pour un pack de crédits (paiement unique). */
export const createCreditCheckout = action({
  args: {
    packId: v.union(
      v.literal("decouverte"),
      v.literal("standard"),
      v.literal("grosBesoin"),
    ),
    origin: v.string(),
  },
  handler: async (ctx, args) => {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return { available: false as const };

    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Vous devez être connecté·e.");

    const pack = CREDIT_PACKS[args.packId];
    if (!pack) throw new Error("Pack inconnu.");

    const config = await ctx.runQuery(internal.credits.findStripeConfig);
    let priceId: string | undefined;

    if (config) {
      const field = args.packId === "decouverte"
        ? "priceDecouverte"
        : args.packId === "standard"
          ? "priceStandard"
          : "priceGrosBesoin";
      priceId = config[field as keyof typeof config] as string | undefined;
    }

    if (!priceId) {
      // Provisionne les produits/prix si pas encore fait
      const provisioned = await ctx.runAction(api.provisionStripe.provisionCreditProducts);
      if (provisioned.provisioned) {
        const newConfig = await ctx.runQuery(internal.credits.findStripeConfig);
        if (newConfig) {
          const field = args.packId === "decouverte"
            ? "priceDecouverte"
            : args.packId === "standard"
              ? "priceStandard"
              : "priceGrosBesoin";
          priceId = newConfig[field as keyof typeof newConfig] as string | undefined;
        }
      }
    }

    if (!priceId) throw new Error("Impossible de trouver le prix du pack.");

    const user = await ctx.runQuery(api.users.currentUser);
    const email = user?.email ?? undefined;

    const serverBase = process.env.SITE_URL ?? process.env.CONVEX_SITE_URL;
    const origin = resolveStripeOrigin(args.origin, serverBase) ?? args.origin;
    const successUrl = `${origin}/credits?success=1`;
    const cancelUrl = `${origin}/credits?cancelled=1`;

    const params: Record<string, string | string[]> = {
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "metadata[userId]": userId as string,
      "metadata[packId]": args.packId,
      "metadata[credits]": String(pack.credits),
      "metadata[amountEur]": String(pack.priceEur),
    };

    if (email) {
      params["customer_email"] = email;
    }

    // Enregistrer l'achat en attente
    await ctx.runMutation(internal.credits.recordPendingPurchase, {
      userId: userId as Id<"users">,
      packId: args.packId,
      credits: pack.credits,
      amountEur: pack.priceEur,
      stripeSessionId: "pending",
    });

    const session = await stripeFetch("/checkout/sessions", params, key);

    return {
      available: true as const,
      url: session.url as string,
    };
  },
});
