import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

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

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Impossible d'envoyer le code. Réessaie.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);
      setError("Le code de vérification est incorrect.");
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
    } catch (error) {
      console.error("Guest login error:", error);
      setError(
        `Connexion invitée impossible : ${
          error instanceof Error ? error.message : "erreur inconnue"
        }`,
      );
      setIsLoading(false);
    }
  };

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
          <img src={logo} alt="StudySnap" width={30} height={30} className="rounded-lg" />
          <span className="font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="glass-panel rounded-3xl p-7 sm:p-9">
            {step === "signIn" ? (
              <>
                <div className="text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="size-7" />
                  </div>
                  <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                    C&apos;est parti 👋
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Entre ton email pour te connecter ou créer ton compte.
                    <br />
                    <span className="font-medium text-foreground">
                      5 scans gratuits par mois, sans carte bancaire.
                    </span>
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="mt-7">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                    <Input
                      name="email"
                      placeholder="ton@email.fr"
                      type="email"
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
                      <>
                        Recevoir mon code
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="mt-5">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white/70 px-2 text-muted-foreground backdrop-blur">
                        Ou
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full rounded-xl bg-white/60"
                      onClick={handleGuestLogin}
                      disabled={isLoading}
                    >
                      <UserX className="mr-2 size-4" />
                      Continuer en invité (démo)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-full rounded-xl bg-white/60 text-muted-foreground"
                      disabled
                      title="Bientôt disponible"
                    >
                      <svg className="mr-2 size-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                      </svg>
                      Continuer avec Google
                      <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        bientôt
                      </span>
                    </Button>
                  </div>
                </div>

                <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                  <Lock className="mr-1 inline size-3" />
                  Mot de passe oublié ? Pas de souci : StudySnap utilise un code
                  envoyé par email, aucun mot de passe à retenir.
                </p>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                    <Mail className="size-7" />
                  </div>
                  <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                    Vérifie ton email
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    On a envoyé un code à 6 chiffres à{" "}
                    <span className="font-semibold text-foreground">
                      {step.email}
                    </span>
                    .
                  </p>
                </div>
                <form onSubmit={handleOtpSubmit} className="mt-7">
                  <input type="hidden" name="email" value={step.email} />
                  <input type="hidden" name="code" value={otp} />
                  <div className="flex justify-center">
                    <InputOTP
                      value={otp}
                      onChange={setOtp}
                      maxLength={6}
                      disabled={isLoading}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                          const form = (e.target as HTMLElement).closest("form");
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      <InputOTPGroup>
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot key={index} index={index} />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  {error && (
                    <p className="mt-3 text-center text-sm text-destructive">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="mt-6 h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Vérification…
                      </>
                    ) : (
                      <>
                        Vérifier et continuer
                        <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    Pas reçu le code ?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => setStep("signIn")}
                    >
                      Réessayer avec un autre email
                    </Button>
                  </p>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <Camera className="size-3.5" />
            En te connectant, tu acceptes les CGU et la politique de
            confidentialité.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
