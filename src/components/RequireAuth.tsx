import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
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

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  const [graceExpired, setGraceExpired] = useState(false);
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Si on est dans un état "non chargé" mais "non authentifié",
  // on lance un timer de grâce. Si l'auth se résout (isLoading redevient
  // true ou isAuthenticated redevient true) avant l'expiration, on
  // annule le timer.
  useEffect(() => {
    if (isLoading || isAuthenticated) {
      // L'auth est en cours ou l'utilisateur est connecté → on annule
      // le timer de grâce et on réinitialise.
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
  }, [isLoading, isAuthenticated]);

  // État de chargement initial ou pendant le délai de grâce → spinner.
  if (isLoading || !graceExpired) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  // Le délai de grâce est écoulé et l'utilisateur n'est toujours pas
  // authentifié → redirige vers la page de connexion.
  const returnTo = `${location.pathname}${location.search}`;
  return (
    <Navigate
      to={`/auth?returnTo=${encodeURIComponent(returnTo)}`}
      replace
    />
  );
}
