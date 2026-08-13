/**
 * Tests du garde-fou d'erreurs globales (src/lib/global-errors.ts) :
 *
 *  - normalisation des rejets non captés (unhandledrejection) et des erreurs
 *    d'exécution (error) en événements lisibles ;
 *  - installation / désinstallation des écouteurs sur une cible simulée ;
 *  - une erreur isolée est rapportée au callback SANS jamais être relancée
 *    (même si le callback lui-même échoue) — l'app ne peut pas planter.
 *
 * Aucun navigateur, aucun backend.
 */

import { describe, expect, test } from "bun:test";

import {
  describeError,
  installGlobalErrorListeners,
  normalizeErrorEvent,
  normalizeRejection,
  stackLinesOf,
  type ErrorListenerTarget,
} from "@/lib/global-errors";

/** Cible d'écouteurs simulée (compatible `window`). */
function makeTarget(): ErrorListenerTarget & {
  listeners: Record<string, Array<(event: unknown) => void>>;
  emit: (type: "unhandledrejection" | "error", event: unknown) => void;
} {
  const listeners: Record<string, Array<(event: unknown) => void>> = {
    unhandledrejection: [],
    error: [],
  };
  return {
    listeners,
    addEventListener(type, listener) {
      listeners[type].push(listener);
    },
    removeEventListener(type, listener) {
      listeners[type] = listeners[type].filter((l) => l !== listener);
    },
    emit(type, event) {
      for (const l of [...listeners[type]]) l(event);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

describe("Normalisation des erreurs", () => {
  test("describeError extrait un message lisible de toute source", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("simple")).toBe("simple");
    expect(describeError({ message: "objet avec message" })).toBe(
      "objet avec message",
    );
    expect(describeError({ reason: new Error("causé par") })).toBe("causé par");
    expect(describeError(42)).toBe("Erreur inattendue");
    expect(describeError(undefined)).toBe("Erreur inattendue");
  });

  test("stackLinesOf découpe et borne la stack trace", () => {
    const err = new Error("x");
    const lines = stackLinesOf(err, 2);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  test("normalizeRejection extrait la raison du rejet", () => {
    const evt = normalizeRejection({
      reason: new Error("mutation a échoué"),
    });
    expect(evt.kind).toBe("rejection");
    expect(evt.message).toBe("mutation a échoué");
  });

  test("normalizeErrorEvent extrait l'erreur du ErrorEvent", () => {
    const evt = normalizeErrorEvent({
      error: new Error("render crash"),
      message: "Uncaught Error: render crash",
    });
    expect(evt.kind).toBe("error");
    expect(evt.message).toBe("render crash");
  });
});

/* ------------------------------------------------------------------ */
/* Installation / désinstallation                                      */
/* ------------------------------------------------------------------ */

describe("installGlobalErrorListeners", () => {
  test("rapporte un rejet non capté au callback (message lisible)", () => {
    const target = makeTarget();
    const reported: string[] = [];
    installGlobalErrorListeners((e) => reported.push(`${e.kind}:${e.message}`), target);

    target.emit("unhandledrejection", { reason: new Error("connexion perdue") });
    expect(reported).toContain("rejection:connexion perdue");
  });

  test("rapporte une erreur d'exécution non captée", () => {
    const target = makeTarget();
    const reported: string[] = [];
    installGlobalErrorListeners((e) => reported.push(`${e.kind}:${e.message}`), target);

    target.emit("error", { error: new Error("null useMemo") });
    expect(reported).toContain("error:null useMemo");
  });

  test("ignore les erreurs cross-origin sans détail (pas de spam)", () => {
    const target = makeTarget();
    const reported: string[] = [];
    installGlobalErrorListeners((e) => reported.push(e.message), target);

    target.emit("error", { message: "Script error." });
    expect(reported).toHaveLength(0);
  });

  test("unsubscribe retire les écouteurs (aucun appel ensuite)", () => {
    const target = makeTarget();
    const reported: string[] = [];
    const off = installGlobalErrorListeners((e) => reported.push(e.message), target);

    target.emit("unhandledrejection", { reason: new Error("premier") });
    off();
    target.emit("unhandledrejection", { reason: new Error("second") });
    expect(reported).toEqual(["premier"]);
  });

  test("sans cible (hors navigateur) : no-op sans erreur", () => {
    expect(() =>
      installGlobalErrorListeners(() => {}, undefined),
    ).not.toThrow();
  });

  test("un callback qui échoue ne fait JAMAIS planter l'application", () => {
    const target = makeTarget();
    let calls = 0;
    const off = installGlobalErrorListeners(() => {
      calls += 1;
      throw new Error("le toast a échoué");
    }, target);

    expect(() =>
      target.emit("unhandledrejection", { reason: new Error("erreur réelle") }),
    ).not.toThrow();
    expect(calls).toBe(1);
    off();
  });

  test("une erreur de lecture d'événement bizarre est absorbée", () => {
    const target = makeTarget();
    const reported: string[] = [];
    installGlobalErrorListeners((e) => reported.push(e.message), target);

    target.emit("unhandledrejection", null);
    target.emit("unhandledrejection", undefined);
    expect(reported.length).toBeGreaterThan(0);
  });
});
