import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { Lock, Sparkles } from "lucide-react";
import { Link } from "react-router";

/**
 * Vrai si l'utilisateur dispose d'un plan payant actif (Student ou Student
 * Pro). Réactif : dès qu'un paiement Stripe est confirmé, le statut
 * d'abonnement change et l'accès complet est immédiatement débloqué.
 */
export function useIsPaid(): boolean {
  const plan = useQuery(api.subscriptions.getMyPlan);
  return plan?.plan === "student" || plan?.plan === "pro";
}

/**
 * Carte d'appel à l'action « Débloquer le fichier complet » affichée sous
 * l'aperçu gratuit (Réponse rapide & fiches de révision). Le contenu complet
 * n'ayant jamais été envoyé au client gratuit (paywall côté serveur), le
 * bouton mène à la page Pricing — le déblocage se produit automatiquement
 * dès que le webhook Stripe passe le compte en plan payant.
 */
export function UnlockCard({
  title = "Le fichier complet est réservé aux abonnés",
  description,
  benefits,
  priceLabel = "Dès 4,99 €/mois · annulable à tout moment",
}: {
  title?: string;
  description?: string;
  benefits?: string[];
  priceLabel?: string;
}) {
  const items =
    benefits ??
    [
      "Toutes les réponses détaillées, exercice par exercice",
      "Export PDF de marque, prêt à imprimer",
      "Scans, fiches et quiz illimités",
    ];
  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 via-white/6 to-coral-500/10 p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-coral-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 size-48 rounded-full bg-indigo-500/15 blur-3xl" />

      <div className="relative">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-indigo-500/30">
          <Lock className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-extrabold tracking-tight">{title}</h3>
        {description && (
          <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
        <ul className="mx-auto mt-4 max-w-sm space-y-2 text-left">
          {items.map((b) => (
            <li
              key={b}
              className="flex items-start gap-2.5 text-sm leading-5 text-muted-foreground"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition-all hover:brightness-110"
          >
            <Lock className="size-4" />
            Débloquer le fichier complet
          </Link>
          <p className="text-xs text-muted-foreground">{priceLabel}</p>
        </div>
      </div>
    </div>
  );
}

/** Bloc « masqué » grisé (flouté) : aperçu des contenus réservés. */
export function MaskedBlock({ label }: { label: string }) {
  return (
    <div className="select-none rounded-2xl border border-white/10 bg-white/4 p-5">
      <div className="flex items-center gap-2 opacity-40 blur-[3px]">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
          ?
        </span>
        <p className="text-sm font-semibold text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-3 space-y-1.5" aria-hidden>
        <span className="block h-2.5 w-11/12 rounded-full bg-white/10 blur-[3px]" />
        <span className="block h-2.5 w-3/4 rounded-full bg-white/10 blur-[3px]" />
        <span className="block h-2.5 w-5/6 rounded-full bg-white/10 blur-[3px]" />
      </p>
    </div>
  );
}
