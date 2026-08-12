/**
 * Tests de sécurité — webhook Stripe : intégrité + anti-rejeu.
 *
 * verifyStripeSignature doit :
 * - accepter une signature HMAC-SHA256 valide et récente ;
 * - REFUSER une signature valide mais rejouée (timestamp trop ancien) ;
 * - REFUSER un corps modifié, des en-têtes malformés et un secret erroné.
 *
 * Le HMAC est recalculé dans le test avec Web Crypto (aucune clé tierce
 * réelle, aucun appel réseau).
 */
import { describe, expect, test } from "bun:test";
import { verifyStripeSignature } from "@/convex/stripe";

const SECRET = "whsec_test_local_fixture_only";
const BODY = JSON.stringify({
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_1", metadata: { plan: "student" } } },
});

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

describe("verifyStripeSignature — intégrité et anti-rejeu", () => {
  test("signature valide et récente → acceptée", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET, ts);
    expect(await verifyStripeSignature(BODY, sig, SECRET)).toBe(true);
  });

  test("signature valide mais REJOUÉE (timestamp il y a > 5 min) → refusée", async () => {
    const oldTs = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes
    const sig = await buildSignature(BODY, SECRET, oldTs);
    expect(await verifyStripeSignature(BODY, sig, SECRET)).toBe(false);
  });

  test("signature du futur (horloge décalée > 5 min) → refusée", async () => {
    const futureTs = Math.floor(Date.now() / 1000) + 10 * 60;
    const sig = await buildSignature(BODY, SECRET, futureTs);
    expect(await verifyStripeSignature(BODY, sig, SECRET)).toBe(false);
  });

  test("corps modifié → refusée (intégrité)", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET, ts);
    const tampered = BODY.replace("student", "pro");
    expect(await verifyStripeSignature(tampered, sig, SECRET)).toBe(false);
  });

  test("mauvais secret → refusée", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET, ts);
    expect(await verifyStripeSignature(BODY, sig, "whsec_other")).toBe(false);
  });

  test("en-tête malformé (pas de t= / v1=) → refusée", async () => {
    expect(await verifyStripeSignature(BODY, "abc", SECRET)).toBe(false);
    expect(
      await verifyStripeSignature(BODY, "t=0,v1=deadbeef", SECRET),
    ).toBe(false);
    expect(await verifyStripeSignature(BODY, "", SECRET)).toBe(false);
  });
});
