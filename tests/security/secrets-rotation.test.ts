/**
 * Tests de sécurité — Rotation des secrets avec chevauchement :
 *
 * - emailOtp : clé primaire refusée (401/403) → repli sur la clé précédente
 *   (FREEBUFF_EMAIL_API_KEY_PREVIOUS) pendant la période de rotation ;
 *   jamais de clé/token dans les erreurs ;
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

const originalPrimary = process.env.FREEBUFF_EMAIL_API_KEY;
const originalPrevious = process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS;

afterEach(() => {
  if (originalPrimary === undefined) delete process.env.FREEBUFF_EMAIL_API_KEY;
  else process.env.FREEBUFF_EMAIL_API_KEY = originalPrimary;
  if (originalPrevious === undefined) delete process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS;
  else process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS = originalPrevious;
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/* 1. Rotation de la clé d'envoi OTP — chevauchement                   */
/* ------------------------------------------------------------------ */

describe("emailOtp — rotation de clé avec chevauchement", () => {
  test("clé primaire refusée (401) → la clé précédente prend le relais", async () => {
    process.env.FREEBUFF_EMAIL_API_KEY = "new-key-rotation";
    process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS = "old-key-rotation";

    const axios = (await import("axios")).default as unknown as {
      post: (...args: unknown[]) => Promise<{ status: number }>;
    };
    const calls: string[] = [];
    vi.spyOn(axios, "post").mockImplementation(async (_url: unknown, _data: unknown, config?: unknown) => {
      const key = (config as { headers: { "x-api-key"?: string } }).headers?.["x-api-key"];
      calls.push(key ?? "");
      if (key === "new-key-rotation") {
        throw Object.assign(new Error("Unauthorized"), {
          response: { status: 401 },
        });
      }
      return { status: 200 };
    });

    // Pendant la période de chevauchement, l'envoi réussit via l'ancienne clé.
    await send({ identifier: "eleve@example.fr", token: "123456" });
    expect(calls).toEqual(["new-key-rotation", "old-key-rotation"]);
  });

  test("les deux clés refusées → erreur générique sans aucune clé", async () => {
    process.env.FREEBUFF_EMAIL_API_KEY = "new-key-rotation";
    process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS = "old-key-rotation";
    const axios = (await import("axios")).default as unknown as {
      post: (...args: unknown[]) => Promise<{ status: number }>;
    };
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("Forbidden"), { response: { status: 403 } }),
    );
    try {
      await send({ identifier: "eleve@example.fr", token: "654321" });
      expect.unreachable("doit échouer");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("new-key-rotation");
      expect(msg).not.toContain("old-key-rotation");
      expect(msg).not.toContain("654321");
      expect(msg).not.toContain("Forbidden");
    }
  });

  test("sans clé du tout → message de configuration, sans token", async () => {
    delete process.env.FREEBUFF_EMAIL_API_KEY;
    delete process.env.FREEBUFF_EMAIL_API_KEY_PREVIOUS;
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
