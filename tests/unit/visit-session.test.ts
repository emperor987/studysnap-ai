/**
 * Tests unitaires — Session « par visite » (src/lib/visit-session.ts).
 *
 * Vérifie que les jetons Convex Auth sont stockés en sessionStorage (et non
 * en localStorage persistant) : fermer puis rouvrir l'app impose de se
 * reconnecter, et les jetons persistants des versions antérieures sont
 * purgés au démarrage.
 */
import { afterEach, describe, expect, test } from "bun:test";

import {
  CONVEX_AUTH_STORAGE_PREFIX,
  clearLegacyPersistentAuthTokens,
  getVisitTokenStorage,
  isConvexAuthStorageKey,
  type TokenStorageLike,
} from "@/lib/visit-session";

/** Faux `Storage` en mémoire pour simuler localStorage / sessionStorage. */
function makeFakeStorage(initial: Record<string, string> = {}): TokenStorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  };
}

const originalWindow = (globalThis as Record<string, unknown>).window;

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as Record<string, unknown>).window;
  } else {
    (globalThis as Record<string, unknown>).window = originalWindow;
  }
});

describe("Session « par visite » (sessionStorage)", () => {
  test("identifie les clés de jetons Convex Auth par leur préfixe", () => {
    expect(CONVEX_AUTH_STORAGE_PREFIX).toBe("__convexAuth");
    expect(isConvexAuthStorageKey("__convexAuthJWT_httpsconvexcloud")).toBe(true);
    expect(isConvexAuthStorageKey("__convexAuthRefreshToken_x")).toBe(true);
    expect(isConvexAuthStorageKey("__convexAuthServerStateFetchTime_x")).toBe(true);
    expect(isConvexAuthStorageKey("studysnap.quizSound")).toBe(false);
    expect(isConvexAuthStorageKey("")).toBe(false);
  });

  test("hors navigateur, aucun stockage de visite n'est fourni", () => {
    expect(getVisitTokenStorage()).toBeUndefined();
  });

  test("dans un navigateur, les jetons vont dans sessionStorage (pas localStorage)", () => {
    const session = makeFakeStorage();
    (globalThis as Record<string, unknown>).window = { sessionStorage: session };
    const storage = getVisitTokenStorage();
    expect(storage).toBe(session);
    // Le stockage retenu est bien la session de l'onglet, pas un stockage
    // persistant : rouvrir l'app = nouvelle session vide.
    expect(session.data.size).toBe(0);
  });

  test("si sessionStorage est inaccessible (sandbox), on retombe sur undefined", () => {
    (globalThis as Record<string, unknown>).window = {
      get sessionStorage() {
        throw new Error("SecurityError: accès bloqué");
      },
    };
    expect(getVisitTokenStorage()).toBeUndefined();
  });

  test("supprime uniquement les jetons persistants des anciennes versions", () => {
    const legacy = makeFakeStorage({
      "__convexAuthJWT_old": "eyJ...",
      "__convexAuthRefreshToken_old": "rt...",
      "studysnap.quizSound": "on",
      "sidebar.collapsed": "1",
    });
    const removed = clearLegacyPersistentAuthTokens(legacy);
    expect(removed).toBe(2);
    expect(legacy.data.has("__convexAuthJWT_old")).toBe(false);
    expect(legacy.data.has("__convexAuthRefreshToken_old")).toBe(false);
    // Les préférences UI non liées à la session sont conservées.
    expect(legacy.data.get("studysnap.quizSound")).toBe("on");
    expect(legacy.data.get("sidebar.collapsed")).toBe("1");
  });

  test("nettoyage sans jetons persistants → 0 suppression, aucune erreur", () => {
    const clean = makeFakeStorage({ "studysnap.quizSound": "off" });
    expect(clearLegacyPersistentAuthTokens(clean)).toBe(0);
    expect(clearLegacyPersistentAuthTokens(undefined as never)).toBe(0);
    expect(clearLegacyPersistentAuthTokens({} as never)).toBe(0);
  });

  test("un stockage illisible ne fait jamais planter le démarrage", () => {
    const broken = {
      get length() {
        return 1;
      },
      key: () => "__convexAuthJWT_x",
      getItem: () => null,
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(clearLegacyPersistentAuthTokens(broken)).toBe(0);
  });
});
