import { Loader2 } from "lucide-react";
import { useConvexAuth } from "convex/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router";

/**
 * Délai de grâce avant redirection vers /auth.
 *
 * Lors de transitions de route, `useConvexAuth()` peut brièvement
 * retourner `isAuthenticated: false` alors que l'utilisateur est bien
 * connecté (reconnexion WebSocket, re-render pendant le lazy-load…).
 * Sans délai, RequireAuth redirige vers /auth pendant un frame → flash
 * visible de la page de connexion.
 *
 * On attend un court délai avant de confirmer que l'utilisateur est
 * réellement déconnecté. Si l'auth se résout pendant ce délai, on
 * affiche un spinner au lieu de rediriger.
 */
const GRACE_MS = 400;

/** Sécurité : si l'auth ne se résout pas en 8 secondes, on affiche
 *  un message d'erreur au lieu de tourner indéfiniment. */
const SAFETY_TIMEOUT_MS = 8_000;

export function RequireAuth({ children }: { children: ReactNode }) {
  // On utilise directement useConvexAuth() pour ne bloquer QUE sur
  // la résolution de la session, PAS sur le chargement du profil
  // utilisateur (useQuery(currentUser)) qui peut prendre plus de temps
  // et n'est pas nécessaire pour autoriser l'accès.
  const { isLoading: authIsLoading, isAuthenticated } = useConvexAuth();
  const location = useLocation();

  const [graceExpired, setGraceExpired] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [safetyExpired, setSafetyExpired] = useState(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timer de sécurité : si l'auth ne se résout pas en 8 secondes,
  // on arrête le spinner et on affiche un état d'erreur récupérable.
  useEffect(() => {
    if (!authIsLoading) {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
      setSafetyExpired(false);
      return;
    }
    safetyTimer.current = setTimeout(() => {
      setSafetyExpired(true);
    }, SAFETY_TIMEOUT_MS);
    return () => {
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
    };
  }, [authIsLoading]);

  // Si on est dans un état "non chargé" mais "non authentifié",
  // on lance un timer de grâce. Si l'auth se résout (authIsLoading redevient
  // true ou isAuthenticated redevient true) avant l'expiration, on
  // annule le timer.
  useEffect(() => {
    if (authIsLoading || isAuthenticated) {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
      setGraceExpired(false);
      return;
    }

    // Non chargé + non authentifié → on lance le timer de grâce.
    graceTimer.current = setTimeout(() => {
      setGraceExpired(true);
    }, GRACE_MS);

    return () => {
      if (graceTimer.current) {
        clearTimeout(graceTimer.current);
        graceTimer.current = null;
      }
    };
  }, [authIsLoading, isAuthenticated]);

  // État de chargement initial ou pendant le délai de grâce → spinner.
  if (authIsLoading && !safetyExpired && !graceExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Sécurité : timeout dépassé → proposer de réessayer.
  if (safetyExpired && authIsLoading) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="glass-panel max-w-md rounded-3xl p-8 text-center">
          <p className="text-sm font-semibold text-foreground">
            Connexion en cours…
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            La connexion prend plus de temps que prévu. Vérifie ta connexion
            internet et réessaie.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="mt-3 block text-xs text-muted-foreground hover:underline"
          >
            Retour à l&apos;accueil
          </a>
        </div>
      </main>
    );
  }

  // Le délai de grâce est écoulé et l'utilisateur n'est toujours pas
  // authentifié → redirige vers la page de connexion.
  if (!isAuthenticated && graceExpired) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  // Authentifié → affiche le contenu protégé.
  // (Ne bloque PAS sur le chargement du profil utilisateur.)
  return <>{children}</>;
}
