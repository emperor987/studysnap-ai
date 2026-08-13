/**
 * StudySnap — écouteurs d'erreurs globaux.
 *
 * Problème corrigé : une erreur asynchrone isolée (mutation Convex qui échoue
 * sur une donnée déjà supprimée, `navigator.clipboard` indisponible dans
 * l'iframe sandbox du preview, promesse non gérée…) produisait un rejet non
 * capté (`unhandledrejection`) silencieux — ou pire, laissait l'app dans un
 * état cassé nécessitant un rafraîchissement manuel.
 *
 * Ce module installe deux écouteurs au niveau `window` :
 *   - `unhandledrejection` : toute promesse rejetée sans catch ;
 *   - `error`              : toute erreur d'exécution non capturée.
 *
 * Le callback (`onEvent`) reçoit un objet normalisé, l'app l'affiche dans un
 * toast discret (voir main.tsx → GlobalErrorToaster). L'erreur est TOUJOURS
 * journalisée et ne remonte jamais : un incident isolé ne peut pas faire
 * tomber l'application. Logique pure, testable en unitaire (pas de window
 * requis — les cibles sont injectées).
 */

export interface GlobalErrorEvent {
  kind: "rejection" | "error";
  message: string;
  /** Premières lignes de la stack trace, si disponible. */
  stackLines: string[];
  /** Erreur brute (pour console.error / débogage). */
  raw: unknown;
  occurredAt: number;
}

/** Types minimaux des cibles injectables (compatibles `window`). */
export interface ErrorListenerTarget {
  addEventListener(
    type: "unhandledrejection" | "error",
    listener: (event: unknown) => void,
  ): void;
  removeEventListener(
    type: "unhandledrejection" | "error",
    listener: (event: unknown) => void,
  ): void;
}

/** Extrait un message lisible d'une erreur / rejet quelconque. */
export function describeError(raw: unknown): string {
  if (raw instanceof Error && raw.message) return raw.message;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const asRecord = raw as { message?: unknown; reason?: unknown };
    if (typeof asRecord.message === "string" && asRecord.message) {
      return asRecord.message;
    }
    if (asRecord.reason) return describeError(asRecord.reason);
  }
  return "Erreur inattendue";
}

/** Extrait jusqu'à `limit` lignes de stack, nettoyées. */
export function stackLinesOf(raw: unknown, limit = 4): string[] {
  const stack =
    raw instanceof Error
      ? raw.stack
      : raw && typeof raw === "object" && "reason" in raw
        ? describeError((raw as { reason: unknown }).reason)
        : "";
  if (!stack) return [];
  return stack
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, limit);
}

/** Normalise un événement `unhandledrejection` en `GlobalErrorEvent`. */
export function normalizeRejection(event: unknown): GlobalErrorEvent {
  const reason =
    event && typeof event === "object" && "reason" in event
      ? (event as { reason: unknown }).reason
      : event;
  return {
    kind: "rejection",
    message: describeError(reason),
    stackLines: stackLinesOf(reason),
    raw: reason,
    occurredAt: Date.now(),
  };
}

/** Normalise un événement `error` (ErrorEvent) en `GlobalErrorEvent`. */
export function normalizeErrorEvent(event: unknown): GlobalErrorEvent {
  const errEvent = event as {
    error?: unknown;
    message?: string;
    filename?: string;
    lineno?: number;
  };
  return {
    kind: "error",
    message: describeError(errEvent?.error ?? errEvent?.message ?? event),
    stackLines: errEvent?.error ? stackLinesOf(errEvent.error) : [],
    raw: event,
    occurredAt: Date.now(),
  };
}

export interface GlobalErrorListenerOptions {
  /** Surcharge de test : console à utiliser pour logger. */
  consoleOverride?: Pick<Console, "error" | "warn">;
}

/**
 * Installe les écouteurs globaux. Retourne une fonction de désinstallation.
 *
 * @param onEvent  appelé pour chaque erreur isolée (l'app affiche un toast).
 * @param target   cible des écouteurs (défaut : `window`, absent hors
 *                 navigateur → aucun écouteur installé).
 */
export function installGlobalErrorListeners(
  onEvent: (event: GlobalErrorEvent) => void,
  target?: ErrorListenerTarget,
  options: GlobalErrorListenerOptions = {},
): () => void {
  const consoleRef = options.consoleOverride ?? console;

  function onRejection(event: unknown) {
    try {
      const normalized = normalizeRejection(event);
      consoleRef.error("[StudySnap] Rejet non capté :", normalized.raw);
      onEvent(normalized);
    } catch {
      // Ne jamais laisser le handler lui-même casser l'app.
    }
  }

  function onError(event: unknown) {
    try {
      const normalized = normalizeErrorEvent(event);
      if (normalized.message === "Script error.") {
        // Erreur cross-origin sans détail exploitable : on ne spamme pas.
        return;
      }
      consoleRef.error("[StudySnap] Erreur d'exécution non captée :", event);
      onEvent(normalized);
    } catch {
      // Idem : silencieux.
    }
  }

  if (!target) return () => {};

  // Les fonctions nommées sont référencées pour removeEventListener.
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("error", onError);

  return () => {
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("error", onError);
  };
}
