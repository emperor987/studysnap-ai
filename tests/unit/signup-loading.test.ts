/**
 * Tests unitaires — Écran de chargement d'inscription (après validation du
 * code reçu par email).
 *
 * Vérifie la logique pure de src/lib/signup-loading.ts : phrases défilantes,
 * détection inscription vs connexion, état « prêt » et repli en cas de timeout.
 */
import { describe, expect, test } from "bun:test";

import {
  SIGNUP_DONE_DELAY_MS,
  SIGNUP_LOADING_PHRASES,
  SIGNUP_LOADING_TIMEOUT_MS,
  SIGNUP_PHRASE_INTERVAL_MS,
  isAuthReady,
  isSignupForEmail,
} from "@/lib/signup-loading";

describe("Écran de chargement d'inscription", () => {
  test("contient les 6 phrases de marque demandées (toutes non vides)", () => {
    expect(SIGNUP_LOADING_PHRASES.length).toBeGreaterThanOrEqual(6);
    for (const phrase of SIGNUP_LOADING_PHRASES) {
      expect(phrase.trim().length).toBeGreaterThan(10);
    }
    // Esprit « accrocheur / relatable » de la marque : réussite scolaire,
    // devoirs, stress de contrôle, StudySnap ou dashboard.
    const joined = SIGNUP_LOADING_PHRASES.join(" ");
    expect(joined).toMatch(/StudySnap|dashboard|réussite|devoirs|stress/i);
  });

  test("les phrases défilent une toutes les ~2-3 s (transition douce)", () => {
    expect(SIGNUP_PHRASE_INTERVAL_MS).toBeGreaterThanOrEqual(2000);
    expect(SIGNUP_PHRASE_INTERVAL_MS).toBeLessThanOrEqual(3000);
  });

  test("inscription par code = aucune adresse associée à un compte existant", () => {
    expect(isSignupForEmail([])).toBe(true);
    expect(isSignupForEmail([{ userId: "u1" }])).toBe(false);
    expect(isSignupForEmail([{ userId: "u1" }, { userId: "u2" }])).toBe(false);
  });

  test("connexion d'un compte existant → PAS d'écran de chargement d'inscription", () => {
    // L'écran n'est déclenché que quand isSignupForEmail(accounts) est vrai.
    expect(isSignupForEmail([{ email: "lea@test.fr", userId: "u1" }])).toBe(
      false,
    );
    expect(isSignupForEmail([{ userId: "u1" }, { userId: "u2" }])).toBe(false);
  });

  test("le chargement n'est terminé que quand la session ET le profil sont prêts", () => {
    expect(isAuthReady({ authenticated: true, authLoading: false })).toBe(true);
    expect(isAuthReady({ authenticated: false, authLoading: false })).toBe(
      false,
    );
    expect(isAuthReady({ authenticated: true, authLoading: true })).toBe(false);
    expect(isAuthReady({ authenticated: false, authLoading: true })).toBe(
      false,
    );
  });

  test("timeout de repli : jamais d'écran bloqué indéfiniment", () => {
    // Un délai raisonnable pour laisser le temps à la création du compte…
    expect(SIGNUP_LOADING_TIMEOUT_MS).toBeGreaterThan(10_000);
    // …mais borné : passé ce délai, on montre le message « tu peux réessayer ».
    expect(SIGNUP_LOADING_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
  });

  test("« Chargement terminé ! » reste bref avant l'ouverture du dashboard", () => {
    expect(SIGNUP_DONE_DELAY_MS).toBeGreaterThan(0);
    expect(SIGNUP_DONE_DELAY_MS).toBeLessThan(2_000);
  });
});
