import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Sparkles, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * Écran de verrouillage du MODE INVITÉ (démo, sans compte).
 *
 * Le mode invité donne accès UNIQUEMENT au résultat d'un scan (1 scan de
 * démo). Les fiches, quiz, historique et progression sont réservés aux
 * comptes : ces pages affichent ce panneau au lieu de leur contenu. La
 * limite est AUSSI appliquée côté serveur (mutations + actions IA) — ce
 * composant ne fait que guider l'utilisateur vers la création de compte.
 */
export function GuestLocked({
  feature = "cette fonctionnalité",
}: {
  feature?: string;
}) {
  const { user } = useAuth();
  const isGuest = user?.isAnonymous === true;
  if (!isGuest) return null;

  return (
    <AppShell title="Crée ton compte" subtitle="Mode démo">
      <div className="glass-panel mx-auto max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-lg shadow-indigo-500/25">
          🔒
        </div>
        <span className="glass-chip mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
          <UserRound className="size-3.5" />
          Réservé aux comptes
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
          {feature} est réservé·e aux comptes
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          En mode invité, tu peux tester StudySnap avec un scan de démo — mais
          les fiches de révision, quiz, historique et progression demandent un
          compte. Crée le tien en quelques secondes, juste avec ton email, et
          continue à scanner gratuitement.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/auth?mode=signup&returnTo=/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            <Sparkles className="size-4" />
            Créer mon compte gratuitement
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
          >
            Retour à l'accueil
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Inscription en 10 secondes : ton email, un code reçu par email, et
          c'est parti. Aucun mot de passe à retenir.
        </p>
      </div>
    </AppShell>
  );
}

/**
 * Verrouille le contenu d'une page pour les invités : rend la page verrouillée
 * à la place des enfants. À utiliser dans les pages réservées aux comptes
 * (fiches, quiz, historique, progression).
 */
export function GuestGate({
  feature,
  children,
}: {
  feature?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  if (user?.isAnonymous === true) {
    return <GuestLocked feature={feature} />;
  }
  return children;
}
