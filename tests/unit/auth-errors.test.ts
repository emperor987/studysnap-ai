/**
 * Tests unitaires — traduction des erreurs d'authentification en messages
 * français clairs (src/lib/auth-errors.ts).
 *
 * Cas couverts : backend/réseau indisponible (détecté avant les autres règles,
 * car un message type « status code 502 » contient aussi « code »), mauvais
 * identifiants, compte existant, rate-limit, mot de passe invalide, code OTP,
 * et erreur inconnue.
 */
import { describe, expect, test } from "bun:test";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const SERVICE_DOWN = "Le service est momentanément indisponible. Réessaie dans quelques instants.";

describe("getAuthErrorMessage — traduction des erreurs d'authentification", () => {
  test("backend injoignable (échec fetch) → service indisponible", () => {
    expect(getAuthErrorMessage(new Error("Failed to fetch"))).toBe(SERVICE_DOWN);
    expect(
      getAuthErrorMessage(new Error("NetworkError when attempting to fetch resource")),
    ).toBe(SERVICE_DOWN);
    expect(getAuthErrorMessage(new Error("Network request failed"))).toBe(SERVICE_DOWN);
  });

  test("HTTP 502/503 du backend → service indisponible (pas confondu avec un code OTP)", () => {
    expect(getAuthErrorMessage(new Error("status code 502"))).toBe(SERVICE_DOWN);
    expect(getAuthErrorMessage({ message: "503 Service Unavailable" })).toBe(SERVICE_DOWN);
    expect(getAuthErrorMessage({ name: "TimeoutError", message: "request timed out" })).toBe(
      SERVICE_DOWN,
    );
  });

  test("mauvais identifiants → email ou mot de passe incorrect", () => {
    expect(getAuthErrorMessage(new Error("Invalid credentials"))).toBe(
      "Email ou mot de passe incorrect.",
    );
    expect(
      getAuthErrorMessage({ data: { code: "InvalidLogin" } }),
    ).toBe("Email ou mot de passe incorrect.");
  });

  test("compte déjà existant → invite à se connecter", () => {
    expect(getAuthErrorMessage(new Error("Account already exists"))).toBe(
      "Un compte existe déjà avec cet email. Connecte-toi.",
    );
  });

  test("trop de tentatives → réessayer plus tard", () => {
    expect(getAuthErrorMessage({ data: { code: "too_many_attempts" } })).toBe(
      "Trop de tentatives de connexion. Réessaie dans quelques minutes.",
    );
  });

  test("mot de passe trop court → message dédié", () => {
    expect(getAuthErrorMessage(new Error("Invalid password"))).toBe(
      "Le mot de passe doit contenir au moins 8 caractères.",
    );
  });

  test("code OTP incorrect/expiré → message dédié", () => {
    expect(getAuthErrorMessage(new Error("Code expired"))).toBe(
      "Le code est incorrect ou expiré. Redemande un code.",
    );
    // Erreur réelle de la bibliothèque quand le code ne correspond pas.
    expect(getAuthErrorMessage(new Error("Could not verify code"))).toBe(
      "Le code est incorrect ou expiré. Redemande un code.",
    );
  });

  test("EMAIL_TAKEN (serveur) → adresse déjà utilisée, connectez-vous", () => {
    expect(
      getAuthErrorMessage({
        data: { code: "EMAIL_TAKEN", message: "Adresse email déjà utilisée, connectez-vous avec." },
      }),
    ).toBe("Adresse email déjà utilisée, connectez-vous avec.");
    expect(getAuthErrorMessage(new Error("Email already used"))).toBe(
      "Adresse email déjà utilisée, connectez-vous avec.",
    );
  });

  test("SITE_URL manquante (bug bloquant) → erreur de configuration claire, pas générique", () => {
    expect(
      getAuthErrorMessage(new Error("Missing environment variable `SITE_URL`")),
    ).toBe(
      "Le service d'envoi de codes est mal configuré. Réessaie dans quelques minutes.",
    );
  });

  test("clé d'envoi absente → message dédié (jamais « code incorrect »)", () => {
    expect(getAuthErrorMessage(new Error("Le service d'envoi de codes n'est pas configuré."))).toBe(
      "Le service d'envoi de codes n'est pas encore configuré. Réessaie dans quelques minutes.",
    );
  });

  test("échec d'envoi du code → message dédié, pas confondu avec un code incorrect", () => {
    expect(getAuthErrorMessage(new Error("Échec de l'envoi du code — réessaie dans un instant."))).toBe(
      "L'envoi du code a échoué — réessaie dans un instant.",
    );
  });

  test("trop de demandes de code par email → message dédié", () => {
    expect(
      getAuthErrorMessage(
        new Error("Trop de demandes de code par email. Réessaie dans quelques minutes."),
      ),
    ).toBe("Trop de demandes de code par email. Réessaie dans quelques minutes.");
  });

  test("erreur inconnue → message générique", () => {
    expect(getAuthErrorMessage(new Error("Something weird happened"))).toBe(
      "Une erreur est survenue. Réessaie.",
    );
    expect(getAuthErrorMessage(null)).toBe("Une erreur est survenue. Réessaie.");
  });
});
