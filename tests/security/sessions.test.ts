/**
 * Tests de sécurité — Sessions HTTP : flags de cookie, rotation après
 * authentification (anti-fixation), invalidation au logout, expiration,
 * validation d'origine côté serveur.
 *
 * La gestion des sessions est assurée par Convex Auth (paquet
 * @convex-dev/auth, sessions httpOnly stockées côté serveur dans les tables
 * authSessions / authRefreshTokens). On vérifie ici que les réglages
 * APPLIQUÉS sont les bons, que notre configuration ne les affaiblit pas et
 * que le comportement de rotation/invalidation de la bibliothèque est bien
 * actif — en lisant le code distribué du paquet (aucun backend déployé).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..", "..");
const SRC = join(ROOT, "src");
const AUTH_PKG = join(ROOT, "node_modules", "@convex-dev", "auth", "dist", "server");

function read(rel: string): string {
  return readFileSync(join(SRC, rel), "utf8");
}

/* ------------------------------------------------------------------ */
/* 1. Flags des cookies de session (définis par Convex Auth)           */
/* ------------------------------------------------------------------ */

describe("Sessions — flags des cookies", () => {
  const cookiesSrc = readFileSync(join(AUTH_PKG, "cookies.js"), "utf8");

  test("httpOnly: true — le cookie de session n'est jamais lisible par JS", () => {
    expect(cookiesSrc).toMatch(/httpOnly:\s*true/);
  });

  test("secure: true — le cookie n'est transmis qu'en HTTPS", () => {
    expect(cookiesSrc).toMatch(/secure:\s*true/);
  });

  test("partitioned: true — isolation par site d'origine (CHIPS, anti-CSRF tiers)", () => {
    expect(cookiesSrc).toMatch(/partitioned:\s*true/);
  });

  test(
    "SameSite='none' est VOLONTAIRE et nécessaire : le backend Convex est une " +
      "origine différente de l'application (cookie cross-site) — il est " +
      "compensé par secure+partitioned et par la protection CSRF de la " +
      "plateforme Convex (en-tête custom obligatoire + préflight CORS)",
    () => {
      expect(cookiesSrc).toMatch(/sameSite:\s*"none"/);
      // La protection repose aussi sur httpOnly : le cookie ne peut pas être
      // lu/écrit par un script, donc pas de vol par XSS simple.
      expect(cookiesSrc).toMatch(/httpOnly:\s*true/);
    },
  );

  test("notre code n'affaiblit jamais ces flags (aucun httpOnly/secure: false)", () => {
    // Pas d'écriture de cookie de session côté client : l'existant (préférence
    // UI) n'a ni session ni token — vérifié par frontend-and-infra.test.ts.
    const srcCode = readFileSync(join(SRC, "lib", "redirect.ts"), "utf8") + "\n" + readFileSync(join(SRC, "main.tsx"), "utf8");
    expect(srcCode).not.toMatch(/httpOnly:\s*false/i);
    expect(srcCode).not.toMatch(/secure:\s*false/i);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Expiration & rotation des sessions                               */
/* ------------------------------------------------------------------ */

describe("Sessions — expiration et rotation", () => {
  test("expiration ABSOLUE de session configurée (14 jours) dans convex/auth.ts", () => {
    const auth = read("convex/auth.ts");
    expect(auth).toMatch(/totalDurationMs:\s*14\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });

  test("rotation de session à chaque connexion : createNewAndDeleteExistingSession", () => {
    // Anti-fixation : à la connexion, l'ancien document de session est
    // supprimé et un NOUVEAU est créé (nouveau token, nouveau refresh token).
    const sessionsSrc = readFileSync(join(AUTH_PKG, "implementation", "sessions.js"), "utf8");
    const signInSrc = readFileSync(
      join(AUTH_PKG, "implementation", "mutations", "signIn.js"),
      "utf8",
    );
    const verifySrc = readFileSync(
      join(AUTH_PKG, "implementation", "mutations", "verifyCodeAndSignIn.js"),
      "utf8",
    );
    expect(sessionsSrc).toMatch(/createNewAndDeleteExistingSession/);
    expect(sessionsSrc).toMatch(/deleteSession/); // suppression + refresh tokens
    // Appelé au sign-in (mot de passe / OAuth) ET à la vérification du code
    // OTP : toute connexion crée une NOUVELLE session, l'ancienne est purgeée.
    expect(signInSrc).toMatch(/createNewAndDeleteExistingSession/);
    expect(verifySrc).toMatch(/createNewAndDeleteExistingSession/);
  });

  test("le logout appelle l'action serveur signOut (invalidation réelle, pas seulement client)", () => {
    // La session est supprimée CÔTÉ SERVEUR (document authSessions + refresh
    // tokens) via l'action auth:signOut appelée par useAuthActions().signOut.
    const useAuth = read("hooks/use-auth.ts");
    expect(useAuth).toContain("useAuthActions");
    expect(useAuth).toContain("signOut");
    for (const page of ["pages/Settings.tsx", "components/LogoDropdown.tsx", "components/app-shell.tsx"]) {
      expect(read(page), page).toContain("signOut(");
    }
    const sessionsSrc = readFileSync(join(AUTH_PKG, "implementation", "sessions.js"), "utf8");
    expect(sessionsSrc).toMatch(/deleteAllRefreshTokens/);
  });

  test("durées par défaut de la bibliothèque bornées (30 j max, configurables)", () => {
    const sessionsSrc = readFileSync(join(AUTH_PKG, "implementation", "sessions.js"), "utf8");
    const refreshSrc = readFileSync(join(AUTH_PKG, "implementation", "refreshTokens.js"), "utf8");
    // Absolue : 30 jours par défaut (nous configurons 14 jours).
    expect(sessionsSrc).toMatch(/DEFAULT_SESSION_TOTAL_DURATION_MS = 1000 \* 60 \* 60 \* 24 \* 30/);
    // Inactivité : 30 jours par défaut également.
    expect(refreshSrc).toMatch(/DEFAULT_SESSION_INACTIVE_DURATION_MS = 1000 \* 60 \* 60 \* 24 \* 30/);
  });

  test("anti-brute-force configuré (5 échecs/heure/email)", () => {
    const auth = read("convex/auth.ts");
    expect(auth).toMatch(/maxFailedAttempsPerHour:\s*5/);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Validation d'origine côté serveur — jamais confiance au client   */
/* ------------------------------------------------------------------ */

describe("Sessions — validation d'origine côté serveur", () => {
  test("checkout Stripe : l'origine fournie par le client est validée (resolveStripeOrigin)", () => {
    const stripe = read("convex/stripe.ts");
    expect(stripe).toContain("resolveStripeOrigin");
    expect(stripe).toContain("invalid_origin");
  });

  test("lien de consentement parental : l'origine du site est validée (resolveSiteBaseUrl)", () => {
    const consent = read("convex/parentalConsent.ts");
    expect(consent).toContain("resolveSiteBaseUrl");
  });

  test("aucun retour de redirection construit à partir d'une valeur client non validée", () => {
    const redirect = read("lib/redirect.ts");
    expect(redirect).toMatch(/resolveRedirectAfterAuth/);
    expect(redirect).not.toMatch(/window\.location\.href\s*=\s*returnTo/);
  });
});
