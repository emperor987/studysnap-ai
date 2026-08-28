import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Camera,
  FileText,
  Gift,
  Home,
  History,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { initials } from "@/lib/format";
import { InstallApp } from "@/components/InstallApp";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/scanner", label: "Scanner", icon: Camera },
  { to: "/sheets", label: "Mes fiches", icon: FileText },
  { to: "/revision", label: "Révision", icon: BookOpen },
  { to: "/exercises", label: "Mes exercices", icon: History },
  { to: "/progress", label: "Progression", icon: BarChart3 },
  { to: "/referral", label: "Parrainage", icon: Gift, emoji: "🎁" },
  { to: "/settings", label: "Paramètres", icon: Settings },
];

const BOTTOM_NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/scanner", label: "Scanner", icon: Camera },
  { to: "/revision", label: "Révision", icon: BookOpen },
  { to: "/sheets", label: "Fiches", icon: FileText },
  { to: "/settings", label: "Profil", icon: Settings },
];

/** Pages auxquelles un invité (démo, sans compte) n'a PAS accès. */
const GUEST_RESTRICTED_PATHS = new Set([
  "/sheets",
  "/revision",
  "/exercises",
  "/progress",
]);

function PlanChip({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const plan = useQuery(api.subscriptions.getMyPlan);
  if (!plan) return null;
  const isFree = plan.plan === "free";
  // Invité : au lieu du plan, un chip « Mode démo » qui mène à la création
  // de compte (1 seul scan de démo — la suite demande un compte).
  if (user?.isAnonymous === true) {
    return (
      <NavLink
        to="/auth?mode=signup"
        className={cn(
          "flex items-center gap-1.5 rounded-full bg-brand-gradient font-semibold text-white transition-all hover:brightness-110",
          compact
            ? "hidden min-[420px]:inline-flex px-2.5 py-1 text-[10px]"
            : "px-3.5 py-1.5 text-xs",
        )}
      >
        <UserRoundPlus className={compact ? "size-3" : "size-3.5"} />
        Mode démo
      </NavLink>
    );
  }
  return (
    <NavLink
      to="/pricing"
      className={cn(
        "flex items-center gap-1.5 rounded-full font-semibold transition-colors",
        compact
          ? "hidden min-[420px]:inline-flex px-2.5 py-1 text-[10px]"
          : "px-3.5 py-1.5 text-xs",
        isFree
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "bg-brand-gradient text-white",
      )}
    >
      {isFree ? (
        <Sparkles className={compact ? "size-3" : "size-3.5"} />
      ) : null}
      {plan.plan === "free"
        ? "Plan gratuit"
        : `Plan ${plan.plan === "pro" ? "Pro" : "Student"}`}
    </NavLink>
  );
}

function UsageBar() {
  const usage = useQuery(api.usage.getMyUsage);
  const location = useLocation();
  if (!usage || usage.plan !== "free" || usage.isGuest) return null;
  const remaining = Math.max(0, usage.limits.scans - usage.usage.scans);
  if (location.pathname.startsWith("/scanner")) return null;
  return (
    <div className="glass-chip rounded-2xl p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">Scans ce mois</span>
        <span className="text-muted-foreground">
          {remaining} restant{remaining > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200/70">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all"
          style={{ width: `${Math.min(100, (usage.usage.scans / usage.limits.scans) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const wipeMyGuestData = useMutation(api.guest.wipeMyGuestData);
  const parental = useQuery(api.parentalConsentStatus.getMyParentalStatus);
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Élève";
  const isGuest = user?.isAnonymous === true;

  // Navigation restreinte pour les invités : seuls Accueil, Scanner et
  // Paramètres restent accessibles (fiches, quiz, historique, progression =
  // réservés aux comptes — aussi bloqués côté serveur).
  const navItems = isGuest
    ? NAV.filter((item) => !GUEST_RESTRICTED_PATHS.has(item.to))
    : NAV;
  const bottomNavItems = isGuest
    ? BOTTOM_NAV.filter((item) => !GUEST_RESTRICTED_PATHS.has(item.to))
    : BOTTOM_NAV;

  const handleSignOut = async () => {
    // Invité : on supprime immédiatement ses données (rien ne survit à la
    // session) avant la déconnexion — la limite est aussi appliquée côté
    // serveur, ceci garantit « aucune donnée persistée ».
    if (isGuest) {
      try {
        await wipeMyGuestData();
      } catch (err) {
        // La purge est un best-effort : le cron quotidien nettoiera les
        // sessions abandonnées. On ne bloque jamais la déconnexion.
        console.warn("[guest] Purge des données à la déconnexion impossible :", err);
      }
    }
    await signOut();
    navigate("/");
  };

  return (
    <div className="bg-glow min-h-screen bg-background text-foreground">
      {/* ---------- Sidebar desktop ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-[#1c1c22]/90 p-5 backdrop-blur-2xl lg:flex">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 px-1">
          <span className="text-xl font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </NavLink>

        <div className="mt-7 flex flex-col gap-2.5">
          <NavLink
            to="/scanner"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-4 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            <Camera className="size-4" />
            Scanner un exercice
          </NavLink>
          {isGuest ? (
            <NavLink
              to="/auth?mode=signup&returnTo=/scanner"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
            >
              <UserRoundPlus className="size-4" />
              Créer mon compte
            </NavLink>
          ) : (
            <NavLink
              to="/sheets"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/10"
            >
              <Plus className="size-4" />
              Nouvelle fiche de révision
            </NavLink>
          )}
        </div>

        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                )
              }
            >
              {"emoji" in item && item.emoji ? (
                <span className="size-[18px] flex items-center justify-center text-base">{item.emoji}</span>
              ) : (
                <item.icon className="size-[18px]" />
              )}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-3">
          <UsageBar />
          <InstallApp variant="sidebar" />
          <PlanChip />
          <div className="mt-1 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initials(firstName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{firstName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {isGuest ? "invité · 1 scan de démo" : user?.email}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={handleSignOut}
              title="Se déconnecter"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Header mobile ---------- */}
      {/* min-w-0 + truncate + PlanChip compact (masqué sous 420 px) : sur les
          petits écrans, le header ne déborde jamais et aucun zoom manuel ne
          devient nécessaire. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-[#121216]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
        <NavLink to="/dashboard" className="flex min-w-0 items-center gap-2">
          <span className="truncate text-lg font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </NavLink>
        <div className="flex shrink-0 items-center gap-1.5">
          <PlanChip compact />
          <InstallApp />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-muted-foreground"
            title="Se déconnecter"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* ---------- Contenu ---------- */}
      <main className="px-5 pb-28 pt-6 sm:px-8 lg:ml-72 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-5xl">
          {parental && parental.status !== "confirmed" && (
            <div className="mb-6 flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-amber-300">
                🔒 Ton compte est en attente de validation par un parent ou
                tuteur légal — ton accès est limité jusqu&apos;à sa confirmation.
              </p>
              <button
                type="button"
                onClick={() => navigate("/auth?mode=parental")}
                className="shrink-0 text-sm font-semibold text-amber-300 underline decoration-amber-500/40 underline-offset-2 transition-colors hover:text-amber-200"
              >
                Voir / renvoyer l&apos;email
              </button>
            </div>
          )}
          {(title || subtitle) && (
            <div className="mb-7">
              {subtitle && (
                <p className="text-sm font-medium text-muted-foreground">{subtitle}</p>
              )}
              {title && (
                <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {title}
                </h1>
              )}
            </div>
          )}
          {children}
        </div>
      </main>

      {/* ---------- Bottom nav mobile ---------- */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#1c1c22]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl lg:hidden">
        <div
          className={cn(
            "mx-auto grid max-w-md",
            bottomNavItems.length === 3 ? "grid-cols-3" : "grid-cols-5",
          )}
        >
          {bottomNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Marque discrète */}
      <div className="pointer-events-none fixed bottom-16 right-4 hidden items-center gap-1.5 text-[10px] text-muted-foreground/50 lg:flex">
        <LayoutGrid className="size-3" />
        StudySnap
      </div>
    </div>
  );
}
