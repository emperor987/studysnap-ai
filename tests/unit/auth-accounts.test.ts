/**
 * Tests unitaires — logique d'affichage de l'écran « Choisir ton compte »
 * (src/lib/auth-accounts.ts) : libellés des providers, nom d'affichage et
 * initiales d'avatar, y compris les cas limites (nom vide, email absent).
 */
import { describe, expect, test } from "bun:test";
import {
  accountAvatarLabel,
  accountDisplayName,
  accountProviderLabel,
} from "@/lib/auth-accounts";

describe("accountProviderLabel — libellés français des providers", () => {
  test("providers connus", () => {
    expect(accountProviderLabel("password")).toBe("Mot de passe");
    expect(accountProviderLabel("email-otp")).toBe("Code par email");
    expect(accountProviderLabel("anonymous")).toBe("Invité");
    expect(accountProviderLabel("vly-convex")).toBe("Freebuff");
  });

  test("provider inconnu → conservé tel quel", () => {
    expect(accountProviderLabel("google")).toBe("google");
  });
});

describe("accountDisplayName — nom d'affichage d'un compte", () => {
  test("prénom utilisé en priorité", () => {
    expect(accountDisplayName({ name: "Léa", email: "lea@example.com" })).toBe(
      "Léa",
    );
  });

  test("nom vide → partie locale de l'email", () => {
    expect(
      accountDisplayName({ name: "   ", email: "lea@example.com" }),
    ).toBe("Compte lea");
  });

  test("nom et email absents → libellé générique", () => {
    expect(accountDisplayName({ name: null, email: null })).toBe(
      "Compte StudySnap",
    );
  });
});

describe("accountAvatarLabel — initiales d'avatar", () => {
  test("prénom + nom → deux initiales", () => {
    expect(accountAvatarLabel({ name: "Léa Martin", email: "lea@x.fr" })).toBe(
      "LM",
    );
  });

  test("un seul mot → deux premières lettres", () => {
    expect(accountAvatarLabel({ name: "Léa", email: "lea@x.fr" })).toBe("LÉ");
  });

  test("pas de nom → début de l'email", () => {
    expect(accountAvatarLabel({ name: null, email: "lea@x.fr" })).toBe("LE");
  });

  test("rien → point d'interrogation", () => {
    expect(accountAvatarLabel({ name: null, email: null })).toBe("?");
  });
});
