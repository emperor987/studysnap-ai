/**
 * Tests de sécurité — Clickjacking : la politique anti-framing APPLIQUÉE
 * refuse effectivement les origines non autorisées.
 *
 * On ne se contente pas de vérifier la présence d'un en-tête : on parse la
 * directive CSP `frame-ancestors` effective (production : public/_headers ;
 * aperçu de dev : vite.config.ts server.headers) et on l'évalue contre des
 * origines attaquantes et légitimes (tests/security/frontend-and-infra.test.ts
 * vérifie la présence brute des en-têtes).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isFramingAllowed, parseFrameAncestors } from "@/lib/frame-ancestors";

const ROOT = resolve(import.meta.dir, "..", "..");
const headersFile = readFileSync(join(ROOT, "public", "_headers"), "utf8");
const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");

function productionCsp(): string {
  return headersFile.match(/Content-Security-Policy:\s*([^\n]+)/i)?.[1] ?? "";
}

/** Extrait l'en-tête Content-Security-Policy déclaré dans vite.config.ts. */
function devCsp(): string {
  // La valeur est délimitée par des guillemets doubles et contient des
  // guillemets simples ('self', 'none') : on capture jusqu'au prochain "".
  const match = viteConfig.match(
    /Content-Security-Policy["']?\s*:\s*"([^"]+)"/,
  );
  return match?.[1] ?? "";
}

describe("Clickjacking — production (public/_headers) : framing totalement bloqué", () => {
  const directives = parseFrameAncestors(productionCsp());

  test("la directive frame-ancestors 'none' est présente", () => {
    expect(directives).toContain("'none'");
  });

  test("aucune origine (même légitime) ne peut intégrer l'application", () => {
    expect(isFramingAllowed(directives, "https://studysnap.app")).toBe(false);
    expect(isFramingAllowed(directives, "https://evil.com")).toBe(false);
    expect(isFramingAllowed(directives, "https://freebuff.com")).toBe(false);
    expect(isFramingAllowed(directives, "https://sub.freebuff.com")).toBe(false);
  });

  test("X-Frame-Options: DENY présent (navigateurs sans CSP frame-ancestors)", () => {
    expect(headersFile).toMatch(/X-Frame-Options:\s*DENY/i);
  });
});

describe("Clickjacking — aperçu de dev (vite.config.ts) : seules les origines nécessaires", () => {
  const directives = parseFrameAncestors(devCsp());

  test("une politique frame-ancestors est bien appliquée par le serveur de dev", () => {
    expect(directives.length).toBeGreaterThan(0);
  });

  test("aucun joker global ('*') ni schéma nu", () => {
    expect(directives).not.toContain("*");
    expect(directives.some((d) => d === "https:" || d === "http:")).toBe(false);
  });

  test("une origine attaquante est REFUSÉE", () => {
    expect(isFramingAllowed(directives, "https://evil.com")).toBe(false);
    expect(isFramingAllowed(directives, "https://attacker.example")).toBe(false);
    expect(isFramingAllowed(directives, "https://freebuff.com.evil.com")).toBe(false);
    expect(isFramingAllowed(directives, "http://freebuff.com")).toBe(false); // http ≠ https
  });

  test("les origines Freebuff (l'hébergeur de l'aperçu) sont ACCEPTÉES", () => {
    expect(isFramingAllowed(directives, "https://freebuff.com")).toBe(true);
    expect(isFramingAllowed(directives, "https://app.freebuff.com")).toBe(true);
    expect(isFramingAllowed(directives, "https://studio.vly.sh")).toBe(true);
  });

  test("'self' autorise l'origine du document lui-même", () => {
    expect(
      isFramingAllowed(directives, "https://preview-a1b2c3.vly.sh", "https://preview-a1b2c3.vly.sh"),
    ).toBe(true);
  });

  test("les autres protocoles / ports sont comparés strictement", () => {
    // hôte libre mais protocole différent → refusé
    expect(isFramingAllowed(directives, "ftp://freebuff.com")).toBe(false);
  });
});

describe("isFramingAllowed — unités", () => {
  test("'none' bat toute autre source", () => {
    expect(isFramingAllowed(["'none'", "https://freebuff.com"], "https://freebuff.com")).toBe(false);
  });

  test("joker de sous-domaine : hôte exact ET sous-domaines", () => {
    expect(isFramingAllowed(["https://*.freebuff.com"], "https://freebuff.com")).toBe(true);
    expect(isFramingAllowed(["https://*.freebuff.com"], "https://x.freebuff.com")).toBe(true);
    expect(isFramingAllowed(["https://*.freebuff.com"], "https://x.y.freebuff.com")).toBe(true);
    expect(isFramingAllowed(["https://*.freebuff.com"], "https://freebuff.com.evil.com")).toBe(false);
  });

  test("origine invalide → refusée", () => {
    expect(isFramingAllowed(["https://freebuff.com"], "not-a-url")).toBe(false);
  });
});
