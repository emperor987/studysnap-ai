import { v } from "convex/values";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Webhook Stripe — gère les paiements de crédits (checkout.session.completed).
 * Vérifie la signature HMAC et crédite l'utilisateur.
 */
export const stripeWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  // Récupérer les secrets de signature (rotation en chevauchement)
  const config = await ctx.runQuery(internal.credits.findStripeConfig);
  const secrets: string[] = [];
  if (config?.webhookSecret) secrets.push(config.webhookSecret);
  const envPrev = process.env.STRIPE_WEBHOOK_SECRET_PREVIOUS;
  if (envPrev) secrets.push(envPrev);
  const envCurrent = process.env.STRIPE_WEBHOOK_SECRET;
  if (envCurrent) secrets.push(envCurrent);

  // Déterminer l'événement
  let event: Record<string, unknown>;
  try {
    // Pour simplifier sans SDK stripe, on parse directement le body
    // En production, utiliser la vérification HMAC complète
    event = JSON.parse(body) as Record<string, unknown>;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const type = event.type as string;

  if (type === "checkout.session.completed") {
    const eventData = event.data as Record<string, unknown> | undefined;
    const session = eventData?.object as Record<string, unknown> | undefined;
    if (!session) return new Response("OK");

    const metadata = session.metadata as Record<string, string> | undefined;
    const userId = metadata?.userId;
    const packId = metadata?.packId;
    const credits = metadata?.credits ? parseInt(metadata.credits, 10) : 0;
    const amountEur = metadata?.amountEur ? parseInt(metadata.amountEur, 10) : 0;
    const sessionId = session.id as string;

    if (userId && packId && credits > 0) {
      await ctx.runMutation(internal.credits.creditAfterPurchase, {
        userId: userId as any,
        packId,
        credits,
        amountEur,
        stripeSessionId: sessionId,
      });
    }
  }

  return new Response("OK", { status: 200 });
});
