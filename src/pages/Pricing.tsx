import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAction, useQuery } from "convex/react";
import { ArrowLeft, Check, Coins, Loader2, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { CREDIT_PACKS, type CreditPackId } from "@/convex/schema";

const packs: { id: CreditPackId; highlight?: boolean }[] = [
  { id: "decouverte" },
  { id: "standard", highlight: true },
  { id: "grosBesoin" },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const createCheckout = useAction(api.stripe.createCreditCheckout);
  const creditInfo = useQuery(api.credits.getMyCreditInfo);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);

  const handleBuy = async (packId: CreditPackId) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate(`/auth?returnTo=${encodeURIComponent("/credits")}`);
      return;
    }
    setLoadingPack(packId);
    try {
      const result = await createCheckout({
        packId,
        origin: window.location.origin,
      });
      if (!result.available) {
        toast.info(
          "Le paiement en ligne arrive bientôt — en attendant, l'app gratuite te laisse tout tester.",
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
      setLoadingPack(null);
    }
  };

  return (
    <div className="min-h-screen text-foreground">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-xl font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-10 sm:px-8">
        <div className="text-center">
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
            <Coins className="size-3.5" />
            Crédits StudySnap
          </span>
          <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">
            Débloque plus de scans.{" "}
            <span className="text-brand-gradient">Sans engagement.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Achète des crédits quand tu en as besoin. Chaque scan complet, fiche
            ou quiz consomme 1 crédit. Le mode Réponse directe reste toujours gratuit.
          </p>
          {creditInfo && (
            <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/5 px-5 py-2.5">
              <Coins className="size-4 text-amber-400" />
              <span className="text-sm font-semibold">
                Solde actuel : {creditInfo.balance} crédit{creditInfo.balance !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {packs.map(({ id, highlight }) => {
            const pack = CREDIT_PACKS[id];
            const price = (pack.priceEur / 100).toFixed(2).replace(".", ",") + " €";
            const perCredit = (pack.priceEur / 100 / pack.credits).toFixed(2).replace(".", ",") + " €/crédit";
            return (
              <div
                key={id}
                className={`glass-card relative flex flex-col rounded-3xl p-7 ${
                  highlight ? "ring-2 ring-primary/50" : ""
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-lg">
                    Meilleur choix
                  </span>
                )}
                <h2 className="text-lg font-bold">{pack.label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pack.credits} crédits
                </p>
                <p className="mt-5">
                  <span className="text-4xl font-black tracking-tight">{price}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    — {perCredit}
                  </span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5">
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                    {pack.credits} scans complets
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                    {pack.credits} fiches de révision
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                    {pack.credits} quiz personnalisés
                  </li>
                  <li className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                    Réponse directe toujours gratuite
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={() => handleBuy(id)}
                  disabled={loadingPack !== null}
                  className={`mt-7 flex items-center justify-center gap-2 rounded-full px-6 py-3 text-center text-sm font-semibold transition-all disabled:opacity-60 ${
                    highlight
                      ? "bg-brand-gradient text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
                      : "border border-border bg-white/8 text-foreground hover:bg-white/15"
                  }`}
                >
                  {loadingPack === id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Redirection…
                    </>
                  ) : (
                    <>
                      {highlight && <Zap className="size-4" />}
                      Acheter ce pack
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center gap-3">
          <p className="text-center text-xs leading-5 text-muted-foreground">
            Paiement sécurisé via Stripe · Pas d&apos;abonnement, pas de récurrence
            · Les crédits n&apos;expirent jamais · Les prix incluent la TVA
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
