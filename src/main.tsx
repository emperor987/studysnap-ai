import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import {
  clearLegacyPersistentAuthTokens,
  getVisitTokenStorage,
} from "@/lib/visit-session";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { toast } from "sonner";
import { installGlobalErrorListeners } from "@/lib/global-errors";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Scanner = lazy(() => import("./pages/Scanner.tsx"));
const ScanResult = lazy(() => import("./pages/ScanResult.tsx"));
const Sheets = lazy(() => import("./pages/Sheets.tsx"));
const SheetView = lazy(() => import("./pages/SheetView.tsx"));
const Revision = lazy(() => import("./pages/Revision.tsx"));
const QuizPlayer = lazy(() => import("./pages/QuizPlayer.tsx"));
const History = lazy(() => import("./pages/History.tsx"));
const Progress = lazy(() => import("./pages/Progress.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const Pricing = lazy(() => import("./pages/Pricing.tsx"));
const LegalCgu = lazy(() => import("./pages/LegalCgu.tsx"));
const LegalPrivacy = lazy(() => import("./pages/LegalPrivacy.tsx"));
const LegalMentions = lazy(() => import("./pages/LegalMentions.tsx"));
const LegalContact = lazy(() => import("./pages/LegalContact.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const ParentalConsentPage = lazy(() => import("./pages/ParentalConsent.tsx"));
const ReferralPage = lazy(() => import("./pages/Referral.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in WebContainer environment). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * Garde-fou dur : une erreur de rendu ne laisse JAMAIS l'aperçu en page
 * blanche. Écran de secours avec RÉCUPÉRATION : « Réessayer » remonte
 * l'erreur (remount de l'arbre), « Revenir à l'accueil » recharge la page —
 * l'utilisateur n'est plus jamais obligé de rafraîchir manuellement.
 */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string; attempt: number }
> {
  state = { hasError: false, message: "", stack: "", attempt: 0 };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  /** « Réessayer » : remonte l'arbre (l'état a pu être corrompu, on repart propre). */
  retry = () => {
    this.setState((s) => ({
      hasError: false,
      message: "",
      stack: "",
      attempt: s.attempt + 1,
    }));
  };
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6 text-foreground">
          <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
              <AlertTriangle className="size-7" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold tracking-tight">
              Oups, un problème est survenu
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Une erreur inattendue a interrompu l&apos;affichage. Tes données
              sont en sécurité — réessaie, ou reviens à l&apos;accueil.
            </p>
            {this.state.message && (
              <p className="mt-3 rounded-xl border border-border/60 bg-white/5 px-3 py-2 text-left text-[11px] leading-4 text-muted-foreground break-words">
                {this.state.message}
              </p>
            )}
            {this.state.stack && (
              <pre className="mt-2 max-h-32 overflow-auto rounded-xl border border-border/60 bg-white/5 p-3 text-left text-[10px] leading-4 text-muted-foreground/80">
                {this.state.stack}
              </pre>
            )}
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={this.retry}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <RotateCcw className="size-4" />
                Réessayer
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
              >
                <Home className="size-4" />
                Revenir à l&apos;accueil
              </button>
            </div>
          </div>
        </div>
      );
    }
    // key={attempt} : après un « Réessayer », les composants sont remontés
    // à neuf (aucun état corrompu ne peut survivre au remount).
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}

/**
 * Erreurs isolées non captées (promesses rejetées, erreurs d'exécution) :
 * journalisées et affichées en toast discret — jamais d'app figée, jamais de
 * rafraîchissement imposé. Un incident isolé ne peut plus dégrader l'app.
 */
function GlobalErrorToaster() {
  useEffect(() => {
    return installGlobalErrorListeners((event) => {
      if (event.kind === "rejection") {
        toast.error(
          `Une action n'a pas pu aboutir : ${event.message}. Réessaie.`,
        );
      }
      // Les erreurs de rendu passent par le RootErrorBoundary (écran de
      // secours avec bouton Réessayer) — rien à faire ici.
    });
  }, []);
  return null;
}

// Création du client Convex protégée : si VITE_CONVEX_URL est manquante ou
// invalide (environnement en cours de provisionnement, build partiel…),
// `new ConvexReactClient(undefined)` lèverait une erreur au chargement du
// module et l'écran resterait vierge. À la place, on affiche un avis clair.
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

let convex: ConvexReactClient | null = null;
if (convexUrl) {
  try {
    convex = new ConvexReactClient(convexUrl);
  } catch (error) {
    console.error("[Convex] VITE_CONVEX_URL invalide :", error);
  }
}

// Session « par visite » : les jetons Convex Auth vivent dans sessionStorage
// (et non localStorage) — fermer puis rouvrir l'app impose de se reconnecter
// (pas de connexion silencieuse automatique).
const visitTokenStorage = getVisitTokenStorage();

// Nettoyage au démarrage : retire les jetons persistants écrits par les
// versions précédentes de l'app, pour qu'aucune session ancienne ne puisse
// reconnecter silencieusement (même si sessionStorage était indisponible).
if (typeof window !== "undefined") {
  try {
    clearLegacyPersistentAuthTokens(window.localStorage);
  } catch (error) {
    console.warn(
      "[Session] Nettoyage du stockage persistant impossible :",
      error,
    );
  }
}

function MissingBackendNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <p className="text-sm font-semibold text-zinc-100">Backend non configuré</p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          La variable VITE_CONVEX_URL n'est pas définie dans cet environnement.
          L'application ne peut pas se connecter à son backend pour l'instant.
        </p>
      </div>
    </div>
  );
}

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

function App() {
  if (!convex) return <MissingBackendNotice />;
  return (
    <ConvexAuthProvider client={convex} storage={visitTokenStorage}>
      {/* Aurora background — fixed behind all content, visible on every page & section */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 32rem at 12% -6%, rgba(79,79,229,0.22), transparent 60%), " +
            "radial-gradient(48rem 28rem at 92% 4%, rgba(255,122,132,0.12), transparent 55%), " +
            "radial-gradient(40rem 30rem at 50% 110%, rgba(30,233,129,0.08), transparent 60%)",
        }}
      />
      <GlobalErrorToaster />
      <BrowserRouter>
        <RouteSyncer />
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/legal/cgu" element={<LegalCgu />} />
            <Route path="/legal/privacy" element={<LegalPrivacy />} />
            <Route path="/legal/mentions-legales" element={<LegalMentions />} />
            <Route path="/legal/contact" element={<LegalContact />} />
            <Route path="/parental-consent" element={<ParentalConsentPage />} />
            <Route
              path="/auth"
              element={<AuthPage redirectAfterAuth="/dashboard" />}
            />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/scanner"
              element={
                <RequireAuth>
                  <Scanner />
                </RequireAuth>
              }
            />
            <Route
              path="/scanner/result/:scanId"
              element={
                <RequireAuth>
                  <ScanResult />
                </RequireAuth>
              }
            />
            <Route
              path="/sheets"
              element={
                <RequireAuth>
                  <Sheets />
                </RequireAuth>
              }
            />
            <Route
              path="/sheets/:sheetId"
              element={
                <RequireAuth>
                  <SheetView />
                </RequireAuth>
              }
            />
            <Route
              path="/revision"
              element={
                <RequireAuth>
                  <Revision />
                </RequireAuth>
              }
            />
            <Route
              path="/revision/quiz/:quizId"
              element={
                <RequireAuth>
                  <QuizPlayer />
                </RequireAuth>
              }
            />
            <Route
              path="/exercises"
              element={
                <RequireAuth>
                  <History />
                </RequireAuth>
              }
            />
            <Route
              path="/progress"
              element={
                <RequireAuth>
                  <Progress />
                </RequireAuth>
              }
            />
            <Route
              path="/referral"
              element={
                <RequireAuth>
                  <ReferralPage />
                </RequireAuth>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireAuth>
                  <Settings />
                </RequireAuth>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster />
    </ConvexAuthProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);
