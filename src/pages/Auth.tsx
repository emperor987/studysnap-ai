import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/hooks/use-auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

type Tab = "signIn" | "signUp";

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );

  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get("mode") === "signup" ? "signUp" : "signIn",
  );
  const [method, setMethod] = useState<"password" | "emailCode">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpStep, setOtpStep] = useState<{ email: string } | null>(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setMethod("password");
    setError(null);
  };

  /* ---------- Connexion / Inscription par mot de passe ---------- */

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Entre ton adresse email.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (tab === "signUp" && password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn("password", {
        flow: tab === "signUp" ? "signUp" : "signIn",
        email: trimmedEmail,
        password,
      });
      navigate(redirect);
    } catch (err) {
      console.error("Password auth error:", err);
      setError(getAuthErrorMessage(err));
      setIsLoading(false);
    }
  };

  /* ---------- Connexion par code email (secours / mot de passe oublié) ---------- */

  const handleEmailCodeRequest = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Entre ton adresse email pour recevoir un code.");
      return;
    }
    setIsLoading(true);
    try {
      await signIn("email-otp", { email: trimmedEmail });
      setOtpStep({ email: trimmedEmail });
      setIsLoading(false);
    } catch (err) {
      console.error("Email code request error:", err);
      setError(getAuthErrorMessage(err));
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!otpStep) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn("email-otp", { email: otpStep.email, code: otp });
      navigate(redirect);
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Le code de vérification est incorrect ou expiré.");
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (err) {
      console.error("Guest login error:", err);
      setError("Connexion invitée impossible, réessaie.");
      setIsLoading(false);
    }
  };

  /* ---------- Écran code par email ---------- */

  if (otpStep) {
    return (
      <AuthShell>
        <div className="glass-panel rounded-3xl p-7 sm:p-9">
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-mint-500/15 text-mint-300">
              <Mail className="size-7" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Vérifie ton email
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              On a envoyé un code à 6 chiffres à{" "}
              <span className="font-semibold text-foreground">
                {otpStep.email}
              </span>
              . Il est valable 15 minutes.
            </p>
          </div>
          <form onSubmit={handleOtpSubmit} className="mt-7">
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Code à 6 chiffres"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="h-12 rounded-xl pl-10 text-center text-lg font-bold tracking-[0.4em]"
                disabled={isLoading}
                required
              />
            </div>
            {error && (
              <p className="mt-2 text-center text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isLoading || otp.length !== 6}
              className="mt-4 h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Vérification…
                </>
              ) : (
                "Vérifier et continuer"
              )}
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Pas reçu le code ?{" "}
              <Button
                type="button"
                variant="link"
                className="h-auto p-0"
                onClick={() => {
                  setOtpStep(null);
                  setOtp("");
                }}
              >
                Réessayer avec un autre email
              </Button>
            </p>
          </form>
        </div>
        <AuthFooter />
      </AuthShell>
    );
  }

  /* ---------- Formulaire code par email (depuis « Se connecter ») ---------- */

  if (tab === "signIn" && method === "emailCode") {
    return (
      <AuthShell>
        <div className="glass-panel rounded-3xl p-7 sm:p-9">
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Mail className="size-7" />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Connexion par email
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Pas de mot de passe à retenir : on t&apos;envoie un code à 6
              chiffres, valable 15 minutes.
            </p>
          </div>
          <form onSubmit={handleEmailCodeRequest} className="mt-7">
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.fr"
                autoComplete="email"
                className="h-12 rounded-xl pl-10"
                disabled={isLoading}
                required
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
            <Button
              type="submit"
              disabled={isLoading}
              className="mt-4 h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Envoi du code…
                </>
              ) : (
                "Recevoir mon code"
              )}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                setMethod("password");
                setError(null);
              }}
            >
              ← Revenir à la connexion par mot de passe
            </Button>
          </p>
        </div>
        <AuthFooter />
      </AuthShell>
    );
  }

  /* ---------- Formulaire principal ---------- */

  return (
    <AuthShell>
      <div className="glass-panel rounded-3xl p-7 sm:p-9">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {tab === "signIn" ? "Bon retour 👋" : "Rejoins StudySnap 🚀"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tab === "signIn"
              ? "Connecte-toi pour retrouver tes exercices et tes fiches."
              : "5 scans gratuits par mois, sans carte bancaire."}
          </p>
        </div>

        {/* Onglets Se connecter / S'inscrire */}
        <div className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-white/8 p-1">
          {(
            [
              { id: "signIn", label: "Se connecter" },
              { id: "signUp", label: "S'inscrire" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={cn(
                "h-10 rounded-xl text-sm font-semibold transition-all",
                tab === t.id
                  ? "bg-primary/15 text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.fr"
              autoComplete="email"
              className="h-12 rounded-xl pl-10"
              disabled={isLoading}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                tab === "signUp"
                  ? "Mot de passe (8 caractères min.)"
                  : "Ton mot de passe"
              }
              autoComplete={tab === "signUp" ? "new-password" : "current-password"}
              className="h-12 rounded-xl pl-10 pr-11"
              disabled={isLoading}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3.5 top-3 text-muted-foreground transition-colors hover:text-foreground"
              tabIndex={-1}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {tab === "signUp" && (
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirmer le mot de passe"
                autoComplete="new-password"
                className="h-12 rounded-xl pl-10"
                disabled={isLoading}
                required
              />
            </div>
          )}

          {tab === "signIn" && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-xs font-semibold text-primary"
                onClick={() => {
                  setMethod("emailCode");
                  setError(null);
                }}
              >
                Mot de passe oublié ?
              </Button>
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {tab === "signIn" ? "Connexion…" : "Création du compte…"}
              </>
            ) : tab === "signIn" ? (
              "Se connecter"
            ) : (
              "Créer mon compte"
            )}
          </Button>
        </form>

        {tab === "signIn" && (
          <>
            <div className="mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white/8 px-2 text-muted-foreground backdrop-blur">
                    Ou
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl bg-white/6"
                  onClick={() => {
                    setMethod("emailCode");
                    setError(null);
                  }}
                >
                  <Mail className="mr-2 size-4" />
                  Me connecter avec un code par email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-full rounded-xl bg-white/6"
                  onClick={handleGuestLogin}
                  disabled={isLoading}
                >
                  <UserX className="mr-2 size-4" />
                  Continuer en invité (démo)
                </Button>
              </div>
            </div>
            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              <Lock className="mr-1 inline size-3" />
              Mot de passe oublié ? Utilise la connexion{" "}
              <span className="font-semibold text-foreground">
                « code par email »
              </span>{" "}
              : un code à 6 chiffres t&apos;est envoyé, aucun mot de passe à
              retenir.
            </p>
          </>
        )}

        {tab === "signUp" && (
          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            En créant ton compte, tu acceptes les CGU et la politique de
            confidentialité.
          </p>
        )}
      </div>
      <AuthFooter />
    </AuthShell>
  );
}

/* ---------- Coquille commune ---------- */

function AuthShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="bg-glow relative flex min-h-screen flex-col overflow-hidden">
      <div className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-coral-500/10 blur-3xl" />

      {/* Barre du haut */}
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à l&apos;accueil
        </button>
        <Link to="/" className="flex items-center gap-2">
          <img
            src={logo}
            alt="StudySnap"
            width={30}
            height={30}
            className="rounded-lg"
          />
          <span className="font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function AuthFooter() {
  return (
    <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
      <Camera className="size-3.5" />
      En te connectant, tu acceptes les CGU et la politique de confidentialité.
    </p>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
