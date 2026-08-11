import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  BookOpen,
  Camera,
  FileText,
  Home,
  History,
  LayoutGrid,
  LogOut,
  Plus,
  Settings,
  Sparkles,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
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
  { to: "/settings", label: "Paramètres", icon: Settings },
];

const BOTTOM_NAV = [
  { to: "/dashboard", label: "Accueil", icon: Home },
  { to: "/scanner", label: "Scanner", icon: Camera },
  { to: "/revision", label: "Révision", icon: BookOpen },
  { to: "/sheets", label: "Fiches", icon: FileText },
  { to: "/settings", label: "Profil", icon: Settings },
];

function PlanChip() {
  const plan = useQuery(api.subscriptions.getMyPlan);
  if (!plan) return null;
  const isFree = plan.plan === "free";
  return (
    <NavLink
      to="/pricing"
      className={cn(
        "flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
        isFree
          ? "bg-primary/10 text-primary hover:bg-primary/15"
          : "bg-brand-gradient text-white",
      )}
    >
      {isFree ? <Sparkles className="size-3.5" /> : null}
      {plan.plan === "free" ? "Plan gratuit" : `Plan ${plan.plan === "pro" ? "Pro" : "Student"}`}
    </NavLink>
  );
}

function UsageBar() {
  const usage = useQuery(api.usage.getMyUsage);
  const location = useLocation();
  if (!usage || usage.plan !== "free") return null;
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
  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Élève";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="bg-glow min-h-screen bg-background text-foreground">
      {/* ---------- Sidebar desktop ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-border bg-[#1c1c22]/90 p-5 backdrop-blur-2xl lg:flex">
        <NavLink to="/dashboard" className="flex items-center gap-2.5 px-1">
          <span className="text-lg font-extrabold tracking-tight">
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
          <NavLink
            to="/sheets"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/10"
          >
            <Plus className="size-4" />
            Nouvelle fiche de révision
          </NavLink>
        </div>

        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
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
              <item.icon className="size-[18px]" />
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
                  {user?.email ?? "invité"}
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
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-[#121216]/85 px-5 py-3 backdrop-blur-xl lg:hidden">
        <NavLink to="/dashboard" className="flex items-center gap-2">
          <span className="font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </NavLink>
        <div className="flex items-center gap-2">
          <PlanChip />
          <InstallApp />
          <button
            type="button"
            onClick={handleSignOut}
            className="flex size-8 items-center justify-center rounded-full bg-white/10 text-muted-foreground"
            title="Se déconnecter"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* ---------- Contenu ---------- */}
      <main className="px-5 pb-28 pt-6 sm:px-8 lg:ml-72 lg:pb-12 lg:pt-10">
        <div className="mx-auto w-full max-w-5xl">
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
        <div className="mx-auto grid max-w-md grid-cols-5">
          {BOTTOM_NAV.map((item) => (
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
