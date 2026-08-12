/**
 * Tests de sécurité — validation des origines (src/lib/url.ts).
 *
 * Les liens de confirmation parentale (envoyés par email avec le token dans
 * l'URL) et les redirections Stripe success/cancel sont construits à partir
 * d'une origine fournie par le client. Un domaine attaquant ne doit jamais
 * être accepté (phishing + vol de token) ; l'email ne doit jamais contenir
 * un chemin arbitraire en plus de l'origine.
 */
import { describe, expect, test } from "bun:test";
import {
  isAllowedOrigin,
  resolveSiteBaseUrl,
  resolveStripeOrigin,
} from "@/lib/url";

const PROD_BASE = "https://studysnap.app";
const DEFAULT = "https://studysnap.app";

describe("isAllowedOrigin — restriction stricte (base configurée)", () => {
  test("origine identique à la base → acceptée", () => {
    expect(isAllowedOrigin("https://studysnap.app", PROD_BASE, true)).toBe(true);
    expect(isAllowedOrigin("https://studysnap.app/whatever", PROD_BASE, true)).toBe(true);
  });

  test("sous-domaine de la base → accepté (aperçus, CDN d'app)", () => {
    expect(isAllowedOrigin("https://preview.studysnap.app", PROD_BASE, true)).toBe(true);
    expect(isAllowedOrigin("https://api.studysnap.app", PROD_BASE, true)).toBe(true);
  });

  test("domaine attaquant → refusé", () => {
    expect(isAllowedOrigin("https://evil.com", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("https://studysnap.app.evil.com", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("https://evilstudysnap.app", PROD_BASE, true)).toBe(false);
  });

  test("protocoles non-https → refusés (même en régime dev)", () => {
    expect(isAllowedOrigin("http://studysnap.app", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("javascript:alert(1)", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("//studysnap.app", PROD_BASE, true)).toBe(false);
    // régime dev : les protocoles non-https restent refusés
    expect(isAllowedOrigin("http://evil.com", DEFAULT, false)).toBe(false);
  });

  test("credentials dans l'URL → refusés (même en régime dev)", () => {
    expect(isAllowedOrigin("https://user:pass@studysnap.app", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("https://user:pass@evil.com", DEFAULT, false)).toBe(false);
  });

  test("entrée non-URL → refusée", () => {
    expect(isAllowedOrigin("not a url", PROD_BASE, true)).toBe(false);
    expect(isAllowedOrigin("", PROD_BASE, true)).toBe(false);
  });
});

describe("resolveSiteBaseUrl — lien email", () => {
  test("aucune valeur client → base serveur", () => {
    expect(resolveSiteBaseUrl(undefined, PROD_BASE)).toBe(PROD_BASE);
    expect(resolveSiteBaseUrl("", PROD_BASE)).toBe(PROD_BASE);
  });

  test("origine légitime du client → utilisée (dev/preview)", () => {
    expect(resolveSiteBaseUrl("https://preview.studysnap.app", PROD_BASE)).toBe(
      "https://preview.studysnap.app",
    );
  });

  test("origine attaquante → repli sur la base serveur (pas de lien vers evil.com)", () => {
    expect(resolveSiteBaseUrl("https://evil.com", PROD_BASE)).toBe(PROD_BASE);
    expect(resolveSiteBaseUrl("http://studysnap.app", PROD_BASE)).toBe(PROD_BASE);
  });

  test("un chemin/query éventuel est retiré (seule l'origine est gardée)", () => {
    expect(resolveSiteBaseUrl("https://studysnap.app/foo?x=1#y", PROD_BASE)).toBe(
      "https://studysnap.app",
    );
  });

  test("base serveur non configurée → toute origine https acceptée (environnement d'aperçu)", () => {
    // Comportement dev uniquement : SITE_URL non renseigné = base par défaut.
    // (hôte ASCII : new URL() normalise les hôtes IDN en punycode)
    expect(resolveSiteBaseUrl("https://preview-a1b2c3.vly.sh", undefined)).toBe(
      "https://preview-a1b2c3.vly.sh",
    );
    expect(resolveSiteBaseUrl("https://evil.com", undefined)).toBe("https://evil.com");
  });
});

describe("resolveStripeOrigin — URLs success/cancel du checkout", () => {
  test("origine légitime → conservée", () => {
    expect(resolveStripeOrigin("https://studysnap.app", PROD_BASE)).toBe(
      "https://studysnap.app",
    );
  });

  test("origine attaquante → null (checkout refusé, pas de redirection malveillante)", () => {
    expect(resolveStripeOrigin("https://evil.com", PROD_BASE)).toBeNull();
    expect(resolveStripeOrigin("http://studysnap.app", PROD_BASE)).toBeNull();
  });

  test("valeur invalide → null", () => {
    expect(resolveStripeOrigin("", PROD_BASE)).toBeNull();
    expect(resolveStripeOrigin("javascript:alert(1)", PROD_BASE)).toBeNull();
  });
});
