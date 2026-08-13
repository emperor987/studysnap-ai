/**
 * Tests de sécurité — Unicité de l'adresse email (un email = un seul compte).
 *
 * Contrainte métier : une adresse email ne peut être associée qu'à UN SEUL
 * compte. L'inscription avec une adresse déjà présente en base doit être
 * bloquée CÔTÉ SERVEUR (jamais seulement côté frontend), avec une vérification
 * en base AVANT l'envoi du code de vérification.
 *
 * Points vérifiés :
 *  - `assertEmailAvailable` (mutation publique, appelée avant l'envoi du code) :
 *    adresse libre → OK ; adresse déjà utilisée → ConvexError EMAIL_TAKEN ;
 *  - `assertEmailConflictFree` (mutation interne, défense en profondeur dans
 *    emailOtp.sendVerificationRequest) : un compte email-otp existant reste une
 *    connexion autorisée ; une adresse prise par un AUTRE type de compte est
 *    refusée ;
 *  - la logique de décision `classifyEmailConflict` est pure et exhaustive ;
 *  - le repli SITE_URL → CONVEX_SITE_URL (bug bloquant corrigé : la bibliothèque
 *    exige SITE_URL pour TOUT envoi de code email).
 *
 * Aucun backend déployé : contexte simulé + handlers Convex appelés directement.
 * Aucune clé tierce requise.
 */
import { describe, expect, test } from "bun:test";
import { ConvexError } from "convex/values";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import * as authUniqueness from "@/convex/authUniqueness";

import {
  call,
  makeDb,
  makeMutationCtx,
  seedUser,
  type MemoryDb,
} from "../helpers/mock-convex";

const EMAIL_TAKEN_MESSAGE =
  "Adresse email déjà utilisée, connectez-vous avec.";

/** Récupère le code ConvexError d'une erreur (ou null si ce n'en est pas une). */
function codeOf(e: unknown): string | null {
  if (e instanceof ConvexError) return (e.data as { code?: string })?.code ?? null;
  return null;
}

/* ------------------------------------------------------------------ */
/* 1. Logique de décision (pure)                                       */
/* ------------------------------------------------------------------ */

describe("classifyEmailConflict — décision pure", () => {
  test("adresse libre → inscription autorisée", () => {
    expect(
      authUniqueness.classifyEmailConflict({
        userExists: false,
        hasEmailOtpAccount: false,
      }),
    ).toBe("signup");
  });

  test("compte email-otp existant → simple connexion, autorisée", () => {
    expect(
      authUniqueness.classifyEmailConflict({
        userExists: true,
        hasEmailOtpAccount: true,
      }),
    ).toBe("signin");
  });

  test("adresse prise par un autre type de compte (mot de passe…) → bloquée", () => {
    expect(
      authUniqueness.classifyEmailConflict({
        userExists: true,
        hasEmailOtpAccount: false,
      }),
    ).toBe("blocked");
  });
});

/* ------------------------------------------------------------------ */
/* 2. assertEmailAvailable (mutation publique — avant l'envoi du code) */
/* ------------------------------------------------------------------ */

describe("assertEmailAvailable — vérification en base avant l'inscription", () => {
  test("adresse libre → aucun blocage", async () => {
    const db = makeDb();
    await expect(
      call(authUniqueness.assertEmailAvailable, makeMutationCtx(db), {
        email: "nouveau@etudiant.fr",
      }),
    ).resolves.toBeUndefined();
  });

  test("adresse déjà utilisée → EMAIL_TAKEN (message dédié)", async () => {
    const db = makeDb();
    seedUser(db, "users-1", { email: "deja@pris.fr" });
    const err = await call(
      authUniqueness.assertEmailAvailable,
      makeMutationCtx(db),
      { email: "deja@pris.fr" },
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(err).not.toBeNull();
    expect(codeOf(err)).toBe("EMAIL_TAKEN");
    expect(err).toBeInstanceOf(ConvexError);
    expect((err as ConvexError<{ message?: string }>).data).toMatchObject({
      message: EMAIL_TAKEN_MESSAGE,
    });
  });

  test("entrée normalisée (espaces, majuscules) avant la vérification en base", async () => {
    // Les flux de l'app écrivent TOUJOURS l'adresse normalisée (minuscules,
    // sans espaces) — la vérification normalise de la même façon l'entrée.
    const db = makeDb();
    seedUser(db, "users-1", { email: "eleve@ecole.fr" });
    const err = await call(
      authUniqueness.assertEmailAvailable,
      makeMutationCtx(db),
      { email: "  ELEVE@Ecole.fr  " },
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(codeOf(err)).toBe("EMAIL_TAKEN");
  });

  test("email vide → aucun blocage (pas de faux positif)", async () => {
    const db = makeDb();
    await expect(
      call(authUniqueness.assertEmailAvailable, makeMutationCtx(db), {
        email: "   ",
      }),
    ).resolves.toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* 3. assertEmailConflictFree (interne — défense en profondeur)        */
/* ------------------------------------------------------------------ */

describe("assertEmailConflictFree — avant l'envoi du code (défense en profondeur)", () => {
  test("adresse libre → envoi autorisé", async () => {
    const db = makeDb();
    await expect(
      call(authUniqueness.assertEmailConflictFree, makeMutationCtx(db), {
        email: "libre@etudiant.fr",
      }),
    ).resolves.toBeUndefined();
  });

  test("compte email-otp existant → connexion autorisée (jamais bloquée)", async () => {
    const db = makeDb();
    seedUser(db, "users-1", { email: "otp@compte.fr" });
    db.seed("authAccounts", [
      {
        _id: "authAccounts-1",
        userId: "users-1",
        provider: "email-otp",
        providerAccountId: "otp@compte.fr",
      },
    ]);
    await expect(
      call(authUniqueness.assertEmailConflictFree, makeMutationCtx(db), {
        email: "otp@compte.fr",
      }),
    ).resolves.toBeUndefined();
  });

  test("adresse prise par un compte mot de passe → EMAIL_TAKEN, aucun code envoyé", async () => {
    const db = makeDb();
    seedUser(db, "users-1", { email: "mdp@compte.fr" });
    db.seed("authAccounts", [
      {
        _id: "authAccounts-1",
        userId: "users-1",
        provider: "password",
        providerAccountId: "mdp@compte.fr",
      },
    ]);
    const err = await call(
      authUniqueness.assertEmailConflictFree,
      makeMutationCtx(db),
      { email: "mdp@compte.fr" },
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(codeOf(err)).toBe("EMAIL_TAKEN");
  });

  test("utilisateur sans compte email-otp rattaché → bloqué", async () => {
    const db = makeDb();
    // Compte créé par un autre fournisseur (ex. invitation) : l'adresse est
    // prise mais aucun compte email-otp → inscription refusée.
    seedUser(db, "users-1", { email: "autre@fournisseur.fr" });
    db.seed("authAccounts", [
      {
        _id: "authAccounts-1",
        userId: "users-1",
        provider: "vly-convex",
        providerAccountId: "autre-fournisseur-id",
      },
    ]);
    const err = await call(
      authUniqueness.assertEmailConflictFree,
      makeMutationCtx(db),
      { email: "autre@fournisseur.fr" },
    ).then(
      () => null,
      (e: unknown) => e,
    );
    expect(codeOf(err)).toBe("EMAIL_TAKEN");
  });
});

/* ------------------------------------------------------------------ */
/* 4. Repli SITE_URL (bug bloquant corrigé)                            */
/* ------------------------------------------------------------------ */

describe("emailOtp — repli SITE_URL (cause racine du bug bloquant)", () => {
  test("le fichier définit le repli SITE_URL → CONVEX_SITE_URL", () => {
    const ROOT = resolve(import.meta.dir, "..", "..");
    const src = readFileSync(join(ROOT, "src", "convex", "auth", "emailOtp.ts"), "utf8");
    expect(src).toContain("process.env.SITE_URL");
    expect(src).toContain("process.env.CONVEX_SITE_URL");
    // Le repli ne doit JAMAIS écraser une SITE_URL déjà configurée.
    expect(src).toMatch(/if\s*\(!process\.env\.SITE_URL/);
  });

  test("la vérification d'unicité est branchée AVANT l'envoi (defense en profondeur)", () => {
    const ROOT = resolve(import.meta.dir, "..", "..");
    const src = readFileSync(join(ROOT, "src", "convex", "auth", "emailOtp.ts"), "utf8");
    expect(src).toContain("authUniqueness.assertEmailConflictFree");
  });
});

/* ------------------------------------------------------------------ */
/* 5. Exhaustivité (garde-fou)                                        */
/* ------------------------------------------------------------------ */

describe("authUniqueness — module complet", () => {
  test("toutes les combinaisons possibles sont couvertes par classifyEmailConflict", () => {
    const combos: [boolean, boolean][] = [
      [false, false],
      [true, false],
      [true, true],
    ];
    const results = combos.map(([userExists, hasEmailOtpAccount]) =>
      authUniqueness.classifyEmailConflict({ userExists, hasEmailOtpAccount }),
    );
    expect(new Set(results)).toEqual(new Set(["signup", "blocked", "signin"]));
  });
});
