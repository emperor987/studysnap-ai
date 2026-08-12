import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { resolveRedirectAfterAuth } from "@/lib/redirect";
import { useAction, useConvex, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UsersRound,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { cn } from "@/lib/utils";
import {
  accountAvatarLabel,
  accountDisplayName,
  accountProviderLabel,
  type AuthAccountInfo,
} from "@/lib/auth-accounts";

interface AuthProps {
  redirectAfterAuth?: string;
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

  // Flux « Choisir ton compte » : email → liste des comptes → mot de passe.
  const convex = useConvex();
  const [signInStep, setSignInStep] = useState<
    "email" | "accounts" | "password"
  >("email");
  const [accounts, setAccounts] = useState<AuthAccountInfo[] | null>(null);
  const [checkingAccounts, setCheckingAccounts] = useState(false);
  const [selectedAccount, setSelectedAccount] =
    useState<AuthAccountInfo | null>(null);

  // Consentement parental (mineurs < 15 ans)
  const submitParental = useAction(api.parentalConsent.submitParentalRequest);
  const resendParental = useAction(api.parentalConsent.resendParentalEmail);
  const parentalStatus = useQuery(api.parentalConsentStatus.getMyParentalStatus);
  const [isMinor, setIsMinor] = useState<boolean | null>(null);
  const [parentEmail, setParentEmail] = useState("");
  const [parentalPending, setParentalPending] = useState(false);
  const [parentalSent, setParentalSent] = useState<boolean | null>(null);
  const [parentalBusy, setParentalBusy] = useState(false);
  const [parentalMsg, setParentalMsg] = useState<string | null>(null);
  const [editingParentEmail, setEditingParentEmail] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setMethod("password");
    setError(null);
    setIsMinor(null);
    setParentEmail("");
    setParentalPending(false);
    // Retour à la première étape du flux sign-in (l'email saisi est conservé).
    setSignInStep("email");
    setAccounts(null);
    setSelectedAccount(null);
    setCheckingAccounts(false);
  };

  const runSubmitParental = async (email: string): Promise<boolean> => {
    const res = await submitParental({
      parentEmail: email,
      siteUrl: window.location.origin,
    });
    return res.emailSent;
  };

  const handleResendParental = async () => {
    setParentalBusy(true);
    setParentalMsg(null);
    try {
      const res = await resendParental({ siteUrl: window.location.origin });
      setParentalSent(res.ok && res.emailSent === true);
      setParentalMsg(
        res.ok && res.emailSent
          ? "Email renvoyé — vérifie la boîte de réception et les spams."
          : "L'email n'a pas pu être envoyé pour l'instant — réessaie dans quelques minutes.",
      );
    } catch (err) {
      console.error(err);
      setParentalMsg(
        "Impossible de renvoyer l'email pour l'instant (attends un peu entre deux envois).",
      );
    } finally {
      setParentalBusy(false);
    }
  };

  const handleUpdateParentEmail = async (newEmail: string) => {
    setParentalBusy(true);
    setParentalMsg(null);
    try {
      const res = await runSubmitParental(newEmail);
      setParentEmail(newEmail);
      setParentalSent(res);
      setEditingParentEmail(false);
      setParentalMsg(
        res
          ? "Nouvel email enregistré — un lien de confirmation vient d'être envoyé."
          : "Nouvel email enregistré — l'envoi a échoué, réessaie dans un instant.",
      );
    } catch (err) {
      console.error(err);
      setParentalMsg("Impossible d'enregistrer cette adresse pour l'instant.");
    } finally {
      setParentalBusy(false);
    }
  };

  /* ---------- Flux « Choisir ton compte » (connexion en plusieurs étapes) ---------- */

  const handleEmailContinue = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError("Entre ton adresse email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Cette adresse email n'est pas valide.");
      return;
    }
    setCheckingAccounts(true);
    try {
      const res = await convex.query(api.users.accountsByEmail, {
        email: trimmedEmail,
      });
      setAccounts(res.accounts);
      setSignInStep("accounts");
    } catch (err) {
      console.error("Vérification de l'adresse impossible :", err);
      setError(getAuthErrorMessage(err));
    } finally {
      setCheckingAccounts(false);
    }
  };

  const selectAccount = (acc: AuthAccountInfo) => {
    setSelectedAccount(acc);
    setPassword("");
    setError(null);
    setSignInStep("password");
  };

  const backToAccounts = () => {
    setSelectedAccount(null);
    setError(null);
  };

  const backToEmail = () => {
    setAccounts(null);
    setSelectedAccount(null);
    setSignInStep("email");
    setError(null);
  };

  /* ---------- Connexion par mot de passe / Inscription ---------- */

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = (
      tab === "signIn" && selectedAccount?.email
        ? selectedAccount.email
        : email
    )
      .trim()
      .toLowerCase();
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
    if (tab === "signUp" && isMinor && !parentEmail.trim()) {
      setError("Renseigne l'email d'un parent ou tuteur légal pour continuer.");
      return;
    }
    if (
      tab === "signUp" &&
      isMinor &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail.trim())
    ) {
      setError("L'adresse email du parent ou tuteur n'est pas valide.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn("password", {
        flow: tab === "signUp" ? "signUp" : "signIn",
        email: trimmedEmail,
        password,
      });
      if (tab === "signUp" && isMinor) {
        // Compte créé : envoi de la demande de validation parentale.
        setParentalPending(true);
        try {
          const sent = await runSubmitParental(parentEmail.trim());
          setParentalSent(sent);
        } catch (err) {
          console.error(err);
          setParentalSent(false);
        }
        setIsLoading(false);
        return; // reste sur l'écran « validation parentale en attente »
      }
      navigate(redirect);
    } catch (err) {
      console.error("Échec de connexion par mot de passe :", err);
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

  /* ---------- Écran validation parentale ---------- */

  const parentalBlocked =
    parentalPending ||
    (searchParams.get("mode") === "parental" &&
      parentalStatus !== undefined &&
      parentalStatus !== null &&
      parentalStatus.status !== "confirmed");

  if (parentalBlocked) {
    const status = parentalStatus?.status ?? "pending";
    return (
      <AuthShell>
        <ParentalPendingPanel
          status={status}
          parentEmail={parentEmail || parentalStatus?.parentEmail || ""}
          sent={parentalSent}
          busy={parentalBusy}
          msg={parentalMsg}
          editing={editingParentEmail}
          onToggleEdit={() => setEditingParentEmail((v) => !v)}
          onResend={handleResendParental}
          onUpdateEmail={handleUpdateParentEmail}
        />
        <AuthFooter />
      </AuthShell>
    );
  }

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

  /* ---------- Écran « Choisir ton compte » ---------- */

  if (tab === "signIn" && signInStep === "accounts" && accounts !== null) {
    return (
      <AuthShell>
        <motion.div
          key={`accounts-${accounts.length}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="glass-panel w-full rounded-3xl p-7 sm:p-9"
        >
          {accounts.length === 0 ? (
            /* Aucun compte associé à cette adresse */
            <div className="text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300">
                <UserX className="size-7" />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                Aucun compte trouvé
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Aucun compte StudySnap n&apos;est associé à{" "}
                <span className="font-semibold text-foreground">
                  {email.trim().toLowerCase()}
                </span>
                . Crée ton compte en 30 secondes — 5 scans gratuits par mois,
                sans carte bancaire.
              </p>
              <Button
                type="button"
                onClick={() => switchTab("signUp")}
                className="mt-6 h-auto min-h-12 w-full whitespace-normal rounded-xl bg-brand-gradient px-4 py-3 text-[13px] font-semibold leading-5 shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 sm:text-sm"
              >
                <Sparkles className="mr-2 size-4 shrink-0" />
                Créer un compte avec cette adresse
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={backToEmail}
                className="mt-3 h-11 w-full rounded-xl"
              >
                ← Utiliser une autre adresse
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <UsersRound className="size-7" />
                </div>
                <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
                  Choisir ton compte
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {accounts.length > 1
                    ? "Plusieurs comptes sont associés à cette adresse. Sélectionne celui avec lequel tu veux continuer."
                    : "Un compte est associé à cette adresse. Sélectionne-le pour continuer."}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {accounts.map((acc) => (
                  <button
                    key={acc.userId}
                    type="button"
                    onClick={() => selectAccount(acc)}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition-all hover:border-primary/40 hover:bg-white/10"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {accountAvatarLabel(acc)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {accountDisplayName(acc)}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {acc.email}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {acc.providers.map((p) => (
                          <span
                            key={p}
                            className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                          >
                            {accountProviderLabel(p)}
                          </span>
                        ))}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Pas ton compte ?{" "}
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 font-semibold"
                  onClick={backToEmail}
                >
                  Utiliser une autre adresse
                </Button>
              </p>
            </>
          )}
        </motion.div>
        <AuthFooter />
      </AuthShell>
    );
  }

  /* ---------- Écran mot de passe (compte sélectionné) ---------- */

  if (tab === "signIn" && signInStep === "password" && selectedAccount) {
    const displayName = accountDisplayName(selectedAccount);
    return (
      <AuthShell>
        <motion.div
          key="password-step"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="glass-panel w-full rounded-3xl p-7 sm:p-9"
        >
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <span className="text-sm font-bold">
                {accountAvatarLabel(selectedAccount)}
              </span>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
              Salut {displayName} 👋
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Entre ton mot de passe pour te connecter avec{" "}
              <span className="font-semibold text-foreground">
                {selectedAccount.email}
              </span>
              .
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="mt-7 space-y-4">
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ton mot de passe"
                autoComplete="current-password"
                className="h-12 rounded-xl pl-10 pr-11"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-3 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
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
                  Connexion…
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Mot de passe oublié ?{" "}
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 font-semibold"
              onClick={() => {
                setMethod("emailCode");
                setError(null);
              }}
            >
              Reçois un code par email
            </Button>
          </p>
          <p className="mt-3 text-center">
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={backToAccounts}
            >
              ← Choisir un autre compte
            </Button>
          </p>
        </motion.div>
        <AuthFooter />
      </AuthShell>
    );
  }

  /* ---------- Formulaire principal ---------- */

  return (
    <AuthShell>
      <motion.div
        key={`main-${tab}-${signInStep}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="glass-panel w-full rounded-3xl p-7 sm:p-9"
      >
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="size-7" />
          </div>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            {tab === "signIn" ? "Bon retour 👋" : "Rejoins StudySnap 🚀"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tab === "signIn"
              ? "Commence par ton adresse email pour retrouver tes exercices et tes fiches."
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

        {tab === "signIn" ? (
          /* ---------- Connexion, étape 1 : l'adresse email ---------- */
          <>
            <form onSubmit={handleEmailContinue} className="mt-6 space-y-4">
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ton@email.fr"
                  autoComplete="email"
                  className="h-12 rounded-xl pl-10"
                  disabled={checkingAccounts}
                  required
                />
              </div>
              {error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={checkingAccounts}
                className="h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
              >
                {checkingAccounts ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Vérification…
                  </>
                ) : (
                  <>
                    Continuer
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
                  <span className="bg-white/8 px-2 text-muted-foreground backdrop-blur">
                    Ou
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-white/6 px-4 py-3 text-[13px] leading-5 sm:text-sm"
                  onClick={() => {
                    setMethod("emailCode");
                    setError(null);
                  }}
                >
                  <Mail className="size-4 shrink-0" />
                  Me connecter avec un code par email
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-white/6 px-4 py-3 text-[13px] leading-5 sm:text-sm"
                  onClick={handleGuestLogin}
                  disabled={checkingAccounts}
                >
                  <UserX className="size-4 shrink-0" />
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
        ) : (
          /* ---------- Inscription ---------- */
          <>
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
                  placeholder="Mot de passe (8 caractères min.)"
                  autoComplete="new-password"
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
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
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

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-semibold text-muted-foreground">
                  Quel est ton âge ?
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsMinor(false)}
                    className={cn(
                      "h-10 rounded-xl text-sm font-semibold transition-all",
                      isMinor === false
                        ? "bg-primary/15 text-foreground shadow-sm"
                        : "bg-white/5 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    15 ans ou plus
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinor(true)}
                    className={cn(
                      "h-10 rounded-xl text-sm font-semibold transition-all",
                      isMinor === true
                        ? "bg-primary/15 text-foreground shadow-sm"
                        : "bg-white/5 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Moins de 15 ans
                  </button>
                </div>
                {isMinor && (
                  <div className="mt-3">
                    <label
                      htmlFor="parent-email"
                      className="mb-1.5 block text-xs font-semibold text-muted-foreground"
                    >
                      Email d&apos;un parent ou tuteur légal (obligatoire)
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
                      <Input
                        id="parent-email"
                        type="email"
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="parent@email.fr"
                        autoComplete="email"
                        className="h-11 rounded-xl pl-10"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">
                      🔒 Ton parent recevra un email de confirmation. Tant
                      qu&apos;il n&apos;a pas validé (lien valable 72 h), ton accès
                      reste limité.
                    </p>
                  </div>
                )}
              </div>

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
                    Création du compte…
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              En créant ton compte, tu acceptes les CGU et la politique de
              confidentialité.
            </p>
          </>
        )}
      </motion.div>
      <AuthFooter />
    </AuthShell>
  );
}

/* ---------- Panneau validation parentale ---------- */

function ParentalPendingPanel({
  status,
  parentEmail,
  sent,
  busy,
  msg,
  editing,
  onToggleEdit,
  onResend,
  onUpdateEmail,
}: {
  status: "pending" | "confirmed" | "expired" | "refused";
  parentEmail: string;
  sent: boolean | null;
  busy: boolean;
  msg: string | null;
  editing: boolean;
  onToggleEdit: () => void;
  onResend: () => void;
  onUpdateEmail: (email: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const isRefused = status === "refused";
  const isExpired = status === "expired";

  return (
    <div className="glass-panel rounded-3xl p-7 sm:p-9">
      <div className="text-center">
        <div
          className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
            isRefused
              ? "bg-rose-500/10 text-rose-300"
              : "bg-amber-500/10 text-amber-300"
          }`}
        >
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
          {isRefused ? "Demande refusée" : "Validation parentale en attente"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {isRefused
            ? "Le parent ou tuteur a refusé (ou signalé) cette demande. Ton accès reste limité — contacte le support si c'est une erreur."
            : isExpired
              ? "Le lien de confirmation a expiré. Renvoie un nouvel email à ton parent, ou renseigne une autre adresse."
              : "Un email de confirmation a été envoyé à ton parent ou tuteur légal. Ton accès est limité tant qu'il n'a pas validé (lien valable 72 h)."}
        </p>
      </div>

      {!editing ? (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
            <p className="text-xs font-semibold text-muted-foreground">
              Email du parent / tuteur
            </p>
            <p className="mt-1 flex items-center gap-2 font-semibold">
              <Mail className="size-4 shrink-0 text-primary" />
              {parentEmail || "—"}
            </p>
          </div>
          {sent === false && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              L&apos;email n&apos;a pas pu être envoyé automatiquement. Réessaie
              dans quelques minutes.
            </p>
          )}
          {msg && <p className="text-sm leading-6 text-muted-foreground">{msg}</p>}
          <Button
            type="button"
            onClick={onResend}
            disabled={busy}
            className="h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110"
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Envoi…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 size-4" />
                Renvoyer l&apos;email
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onToggleEdit}
            disabled={busy}
            className="h-11 w-full rounded-xl"
          >
            Changer l&apos;adresse du parent
          </Button>
          <Link
            to="/dashboard"
            className="block text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Revenir au tableau de bord
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim();
            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              onUpdateEmail(value);
            }
          }}
          className="mt-6 space-y-4"
        >
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
            <Input
              type="email"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="parent@email.fr"
              className="h-12 rounded-xl pl-10"
              disabled={busy}
              required
            />
          </div>
          {msg && <p className="text-sm leading-6 text-muted-foreground">{msg}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="h-auto min-h-12 w-full whitespace-normal rounded-xl bg-brand-gradient px-4 py-3 text-[13px] font-semibold leading-5 shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 sm:text-sm"
          >
            {busy ? (
              <Loader2 className="mr-2 size-4 shrink-0 animate-spin" />
            ) : (
              <MailCheck className="mr-2 size-4 shrink-0" />
            )}
            Envoyer un nouveau lien à cette adresse
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleEdit}
            disabled={busy}
            className="h-10 w-full"
          >
            ← Annuler
          </Button>
        </form>
      )}
    </div>
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
          <span className="text-lg font-extrabold tracking-tight">
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
