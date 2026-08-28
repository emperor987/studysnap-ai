import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Check,
  Gift,
  Users,
  Crown,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function Referral() {
  const code = useMutation(api.referral.getMyReferralCode);
  const stats = useQuery(api.referral.getMyReferralStats);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the code on mount
  const loadCode = async () => {
    try {
      const c = await code({});
      setReferralCode(c);
    } catch (e) {
      console.error(e);
    }
  };

  // Load on first render
  if (!referralCode) {
    loadCode();
  }

  const link = referralCode
    ? `https://studysnap.fr/signup?ref=${referralCode}`
    : "";

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Lien copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  return (
    <AppShell
      title="Parrainage 🎁"
      subtitle="Invite un ami : quand il achète un pack de crédits, tu gagnes +7 jours Premium. Gratuit."
    >
      {/* Main card */}
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-coral-500/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#FF6B4A] text-xl">
              🎁
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">
                Ton lien de parrainage
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Partage-le partout — bio, DM, groupe. Chaque ami qui achète un
                pack de crédits = <strong className="text-foreground">+7 jours Premium</strong> pour toi.
              </p>
            </div>
          </div>

          {/* Referral link */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white/80 truncate">
              {link || "Chargement…"}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!link}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#FF6B4A] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="size-4" />
                  Copié ✓
                </>
              ) : (
                <>
                  <Copy className="size-4" />
                  Copier mon lien
                </>
              )}
            </button>
          </div>

          <p className="mt-3 text-xs text-muted-foreground/70">
            Chaque filleul qui achète un pack te rapporte +7 jours de Premium
            gratuits. Pas de limite.
          </p>
        </div>
      </section>

      {/* Stats cards */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Users className="size-5" />}
          label="Amis inscrits"
          value={stats?.signups ?? "—"}
          color="text-primary bg-primary/10"
        />
        <StatCard
          icon={<Crown className="size-5" />}
          label="Passés Premium"
          value={stats?.premium ?? "—"}
          color="text-amber-400 bg-amber-500/10"
        />
        <StatCard
          icon={<Sparkles className="size-5" />}
          label="Bonus Premium"
          value={stats?.bonusDays ? `${stats.bonusDays}j` : "—"}
          color="text-mint-300 bg-mint-500/10"
        />
      </section>

      {/* How it works */}
      <section className="mt-8">
        <h3 className="text-lg font-bold">Comment ça marche ?</h3>
        <div className="mt-4 space-y-3">
          {[
            {
              step: "1",
              text: "Partage ton lien de parrainage avec un ami.",
            },
            {
              step: "2",
              text: "Ton ami s'inscrit via ton lien et achète un pack de crédits.",
            },
            {
              step: "3",
              text: "Tu reçois automatiquement +7 jours de Premium gratuit.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/4 p-4"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#FF6B4A] text-xs font-bold text-white">
                {item.step}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-8">
        <a
          href="/scanner"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#4F46E5] to-[#FF6B4A] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
        >
          Scanner un exercice
          <ArrowRight className="size-4" />
        </a>
      </section>
    </AppShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <p className="mt-3 text-3xl font-extrabold tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
