/**
 * Tests de sécurité — secrets : aucun secret codé en dur, aucun token/clé
 * dans les messages d'erreur, tokens parentaux hachés et à usage unique.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { vi } from "bun:test";

import { emailOtp } from "@/convex/auth/emailOtp";
import { generateToken, hashToken } from "@/lib/consent-token";

const ROOT = resolve(import.meta.dir, "..", "..");
const SRC = join(ROOT, "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 1. Aucun secret codé en dur dans le code source                     */
/* ------------------------------------------------------------------ */

describe("Secrets — rien en dur dans le code source", () => {
  const srcFiles = walk(SRC);
  const srcCode = srcFiles.map((p) => readFileSync(p, "utf8")).join("\n");

  test("aucune clé API en clair (format x-api-key: \"...\")", () => {
    // Une clé lue depuis l'environnement ne matche pas ce pattern
    // (process.env…); une clé littérale, si.
    const hardcoded = srcCode.match(/x-api-key["']?\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/g);
    expect(hardcoded).toBeNull();
  });

  test("aucun secret d'infrastructure en clair (Stripe, NVIDIA, webhook)", () => {
    expect(srcCode).not.toMatch(/sk_(live|test)_[A-Za-z0-9]{10,}/);
    expect(srcCode).not.toMatch(/whsec_[A-Za-z0-9]{10,}/);
    expect(srcCode).not.toMatch(/nvapi-[A-Za-z0-9_-]{10,}/);
    expect(srcCode).not.toMatch(/AI_API_KEY\s*[:=]\s*["'][^"']{8,}["']/);
  });

  test("emailOtp lit sa clé depuis process.env et n'a plus de clé en dur", () => {
    const otp = readFileSync(join(SRC, "convex/auth/emailOtp.ts"), "utf8");
    expect(otp).toContain("process.env.FREEBUFF_EMAIL_API_KEY");
    expect(otp).not.toContain("fb_email_");
  });
});

/* ------------------------------------------------------------------ */
/* 2. Les erreurs d'envoi d'OTP ne fuient ni token ni clé              */
/* ------------------------------------------------------------------ */

describe("emailOtp — pas de fuite de secret dans les erreurs", () => {
  const originalKey = process.env.FREEBUFF_EMAIL_API_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.FREEBUFF_EMAIL_API_KEY;
    else process.env.FREEBUFF_EMAIL_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  test("clé non configurée → message générique, sans le token", async () => {
    delete process.env.FREEBUFF_EMAIL_API_KEY;
    const send = (
      emailOtp as unknown as {
        sendVerificationRequest: (o: {
          identifier: string;
          token: string;
        }) => Promise<void>;
      }
    ).sendVerificationRequest;
    try {
      await send({ identifier: "eleve@example.fr", token: "483920" });
      expect.unreachable("devrait échouer sans clé");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("483920");
      expect(msg).not.toContain("fb_email_");
      expect(msg.toLowerCase()).toContain("configur");
    }
  });

  test("échec du fournisseur → message générique (pas de JSON.stringify de l'erreur axios)", async () => {
    process.env.FREEBUFF_EMAIL_API_KEY = "fixture-key";
    const axios = (await import("axios")).default as unknown as {
      post: (url: string, data?: unknown, config?: unknown) => Promise<unknown>;
    };
    vi.spyOn(axios, "post").mockRejectedValue(
      Object.assign(new Error("Request failed"), {
        config: {
          headers: { "x-api-key": "fixture-key" },
          data: JSON.stringify({ otp: "483920" }),
        },
      }),
    );
    const send = (
      emailOtp as unknown as {
        sendVerificationRequest: (o: {
          identifier: string;
          token: string;
        }) => Promise<void>;
      }
    ).sendVerificationRequest;
    try {
      await send({ identifier: "eleve@example.fr", token: "483920" });
      expect.unreachable("devrait échouer");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).not.toContain("483920");
      expect(msg).not.toContain("fixture-key");
      expect(msg).not.toContain("config");
      expect(msg).not.toContain("headers");
    }
  });
});

/* ------------------------------------------------------------------ */
/* 3. Tokens parentaux : hachés au repos, aléatoires, à usage unique    */
/* ------------------------------------------------------------------ */

describe("Tokens de consentement parental", () => {
  test("le token est stocké UNIQUEMENT en hash SHA-256 (jamais le token brut)", () => {
    const token = "azerty123";
    const hash = hashToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
    expect(hash).not.toContain(token);
    expect(hashToken(token)).toBe(hash); // déterministe (comparaison possible)
  });

  test("le code source n'écrit jamais le token brut en base", () => {
    const consent = readFileSync(join(SRC, "convex/parentalConsent.ts"), "utf8");
    // seul le hash est persisté ; le token brut ne transite que dans l'URL/email
    expect(consent).toContain("parentalConsentTokenHash: hash");
    expect(consent).not.toContain("token: token");
  });

  test("generateToken produit 256 bits aléatoires uniques", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
    expect(a.token.length).toBeGreaterThanOrEqual(40); // base64url(32 octets)
    // jamais deux appels avec le même hash (unicité du lien)
    const hashes = new Set([a.hash, b.hash]);
    expect(hashes.size).toBe(2);
  });

  test("l'expiration du token est bornée (72 h)", () => {
    const { expiresAt } = generateToken();
    const diffMs = expiresAt - Date.now();
    expect(diffMs).toBeGreaterThan(71 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThanOrEqual(72 * 60 * 60 * 1000);
  });
});
