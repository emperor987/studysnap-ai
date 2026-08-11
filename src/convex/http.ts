import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { stripeWebhook } from "./stripe";

const http = httpRouter();

auth.addHttpRoutes(http);

// Webhook Stripe (abonnements)
http.route({ path: "/stripe-webhook", method: "POST", handler: stripeWebhook });

export default http;
