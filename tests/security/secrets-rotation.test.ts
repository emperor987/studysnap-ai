/**
 * Tests de sécurité — Rotation des secrets avec chevauchement :
 *
 * - emailOtp : envoi via le service email natif de la plateforme
 *   (VLY_INTEGRATION_KEY injectée automatiquement — plus de clé à stocker ni
 *   à faire tourner manuellement) ; un refus du service reste générique pour
 *   le client, jamais de clé/token dans les erreurs ;
 * - Stripe : le webhook accepte la signature signée avec l'ancien OU le
 *   nouveau secret (STRIPE_WEBHOOK_SECRET[_PREVIOUS]), intégrité + anti-rejeu
 *   conservés ;
 * - CI : aucun workflow ne journalise un secret GitHub Actions.
 *
 * Aucun appel réseau, aucune clé tierce : fournisseurs mockés, HMAC recalculé
 * avec Web Crypto (fixtures locales uniquement).
 */
import { afterEach, describe, expect, test, vi } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { emailOtp } from "@/convex/auth/emailOtp";
import { verifyStripeSignatureAny } from "@/convex/stripe";

const ROOT = resolve(import.meta.dir, "..", "..");

const send = (
  emailOtp as unknown as {
    sendVerificationRequest: (o: { identifier: string; token: string }) => Promise<void>;
  }
).sendVerificationRequest;

const originalVlyKey = process.env.VLY_INTEGRATION_KEY;

afterEach(() => {
  if (originalVlyKey === undefined) delete process.env.VLY_INTEGRATION_KEY;
  else process.env.VLY_INTEGRATION_KEY = originalVlyKey;
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Envoi OTP via le service email natif de la plateforme            */
/* ------------------------------------------------------------------ */

describe("emailOtp — service email natif (VLY_INTEGRATION_KEY)", () => {
  test("clé de la plateforme présente → envoi via vly.email.send, sans fuite", async () => {
    process.env.VLY_INTEGRATION_KEY = "fixture-key";
    const { vly } = await import("@/lib/vly-integrations");
    const sendEmail = vi
      .spyOn(vly.email, "send")
      .mockResolvedValue({ success: true } as never);

    await send({ identifier: "eleve@example.fr", token: "123456" });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const payload = sendEmail.mock.calls[0][0] as {
      to: string;
      subject: string;
      text: string;
      html: string;
    };
    expect(payload.to).toBe("eleve@example.fr");
    expect(payload.text).toContain("123456");
    expect(payload.html).toContain("123456");
  });

  test("service refusé → erreur générique, sans clé ni token ni cause exposée", async () => {
    process.env.VLY_INTEGRATION_KEY = "fixture-key";
    const { vly } = await import("@/lib/vly-integrations");
    vi.spyOn(vly.email, "send").mockResolvedValue({
      success: false,
      error: "fixture-key otp=654321 headers Forbidden",
    } as never);
    try {
      await send({ identifier: "eleve@example.fr", token: "654321" });
      expect.unreachable("doit échouer");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("fixture-key");
      expect(msg).not.toContain("654321");
      expect(msg).not.toContain("Forbidden");
    }
  });

  test("sans clé du tout → message de configuration, sans token", async () => {
    delete process.env.VLY_INTEGRATION_KEY;
    try {
      await send({ identifier: "eleve@example.fr", token: "777777" });
      expect.unreachable("doit échouer sans clé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("777777");
      expect(msg.toLowerCase()).toContain("configur");
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. Webhook Stripe — multi-secrets en chevauchement                  */
/* ------------------------------------------------------------------ */

const SECRET_NEW = "whsec_test_rotation_new_fixture";
const SECRET_OLD = "whsec_test_rotation_old_fixture";
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

describe("verifyStripeSignatureAny — rotation de secret du webhook", () => {
  test("signé avec l'ANCIEN secret pendant le chevauchement → accepté", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET_OLD, ts);
    expect(
      await verifyStripeSignatureAny(BODY, sig, [SECRET_NEW, SECRET_OLD]),
    ).toBe(true);
  });

  test("signé avec le NOUVEAU secret → accepté", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET_NEW, ts);
    expect(
      await verifyStripeSignatureAny(BODY, sig, [SECRET_NEW, SECRET_OLD]),
    ).toBe(true);
  });

  test("signé avec un secret hors liste → refusé", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, "whsec_unknown", ts);
    expect(
      await verifyStripeSignatureAny(BODY, sig, [SECRET_NEW, SECRET_OLD]),
    ).toBe(false);
  });

  test("signature rejouée (timestamp ancien) → refusée même avec le bon secret", async () => {
    const oldTs = Math.floor(Date.now() / 1000) - 10 * 60;
    const sig = await buildSignature(BODY, SECRET_NEW, oldTs);
    expect(
      await verifyStripeSignatureAny(BODY, sig, [SECRET_NEW, SECRET_OLD]),
    ).toBe(false);
  });

  test("aucun candidat → refusé (jamais de 'true' par défaut)", async () => {
    const ts = Math.floor(Date.now() / 1000);
    const sig = await buildSignature(BODY, SECRET_NEW, ts);
    expect(await verifyStripeSignatureAny(BODY, sig, [])).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* 3. CI — les workflows ne journalisent jamais un secret              */
/* ------------------------------------------------------------------ */

describe("CI/CD — aucun secret dans les logs", () => {
  const workflowsDir = join(ROOT, ".github", "workflows");
  const files = readdirSync(workflowsDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

  test("au moins un workflow CI existe", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  test("aucun 'echo' d'un secret GitHub Actions dans les workflows", () => {
    for (const f of files) {
      const src = readFileSync(join(workflowsDir, f), "utf8");
      expect(
        src.match(/^\s*echo[^\n]*\$\{\{\s*secrets\./gim),
        `${f} ne doit pas journaliser un secret`,
      ).toBeNull();
    }
  });

  test("les workflows n'écrivent pas les secrets dans des fichiers .env", () => {
    for (const f of files) {
      const src = readFileSync(join(workflowsDir, f), "utf8");
      expect(
        src.match(/secrets\.[A-Z_0-9]+\s*>>\s*\.?env/i),
        `${f} ne doit pas écrire de secret dans un fichier`,
      ).toBeNull();
    }
  });
});
