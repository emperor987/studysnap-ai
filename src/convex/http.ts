import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { health } from "./health";
import { stripeWebhook } from "./stripe";

const http = httpRouter();

auth.addHttpRoutes(http);

// Contrôle santé public (surveillance uptime) — aucune donnée interne.
http.route({ path: "/health", method: "GET", handler: health });

// Webhook Stripe (abonnements)
http.route({ path: "/stripe-webhook", method: "POST", handler: stripeWebhook });

export default http;
