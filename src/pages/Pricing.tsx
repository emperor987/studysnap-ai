import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAction } from "convex/react";
import { ArrowLeft, Check, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { PLANS } from "@/lib/plans";

export default function Pricing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planId: "student" | "pro") => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent("/pricing")}`);
      return;
    }
    setLoadingPlan(planId);
    try {
      const result = await createCheckout({
        plan: planId,
        origin: window.location.origin,
      });
      if (!result.available) {
        toast.info(
          "Le paiement en ligne arrive bientôt — en attendant, le plan gratuit te laisse tout tester.",
        );
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
    } catch (e) {
      console.error(e);
      toast.error("Impossible de lancer le paiement pour l'instant.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="bg-glow min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à l&apos;accueil
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-24 pt-10 sm:px-8">
        <div className="text-center">
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Pricing StudySnap
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            Commence gratuitement.{" "}
            <span className="text-brand-gradient">Upgrade quand tu veux.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Tu testes d&apos;abord l&apos;app avec 5 scans gratuits par mois,
            sans carte bancaire. Les plans payants ne servent qu&apos;à débloquer
            plus de capacité quand tu en as vraiment besoin.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const paid = plan.id !== "free";
            return (
              <div
                key={plan.id}
                className={`glass-card relative flex flex-col rounded-3xl p-7 ${
                  plan.highlight ? "ring-2 ring-primary/50" : ""
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-lg">
                    Le plus choisi
                  </span>
                )}
                <h2 className="text-lg font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <p className="mt-5">
                  <span className="text-4xl font-black tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {plan.priceNote}
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.id === "free" ? (
                  <Link
                    to="/auth?returnTo=%2Fdashboard"
                    className="mt-7 rounded-full bg-brand-gradient px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan.id as "student" | "pro")}
                    disabled={loadingPlan !== null}
                    className={`mt-7 flex items-center justify-center gap-2 rounded-full px-6 py-3 text-center text-sm font-semibold transition-all disabled:opacity-60 ${
                      plan.highlight
                        ? "bg-brand-gradient text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
                        : "border border-border bg-white/8 text-foreground hover:bg-white/15"
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Redirection…
                      </>
                    ) : (
                      <>
                        {plan.id === "pro" && <Zap className="size-4" />}
                        {plan.cta}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Annulable à tout moment · Paiement sécurisé via Stripe · Les prix
            incluent la TVA · Fair-use : une utilisation raisonnable, pour un
            usage scolaire.
          </p>
          <Link
            to="/auth?returnTo=%2Fscanner"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
          >
            Scanner gratuitement avant de décider
            <ArrowLeft className="size-4 rotate-180" />
          </Link>
        </div>
      </main>
    </div>
  );
}
