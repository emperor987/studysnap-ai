import { AnimatePresence, motion, useInView } from "framer-motion";
import { HeroPhoneWidget, DemoPhoneWidget } from "@/components/PhoneFrame";
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  FileText,
  Flame,
  GraduationCap,
  ListChecks,
  Lock,
  MessageSquare,
  Phone,
  Play,
  ScanLine,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

/* ═══════════════════════════════════════════════════════════════════════
   ANIMATION HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0 },
};

function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SOCIAL COUNTER
   ═══════════════════════════════════════════════════════════════════════ */

const SOCIAL_BASE = 12843;
const SOCIAL_STEP = 50;
const SOCIAL_STEP_MS = 2 * 60 * 60 * 1000;
const SOCIAL_EPOCH = Date.UTC(2026, 7, 11, 0, 0, 0);

function solvedCount() {
  return Math.floor(Math.max(0, Date.now() - SOCIAL_EPOCH) / SOCIAL_STEP_MS) * SOCIAL_STEP;
}

function useSocialCounter() {
  const [count, setCount] = useState(SOCIAL_BASE + solvedCount());
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const target = SOCIAL_BASE + solvedCount();
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1800);
      setCount(Math.round(SOCIAL_BASE + (target - SOCIAL_BASE) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    let timeout = 0;
    const schedule = () => {
      const untilNext = SOCIAL_STEP_MS - ((Date.now() - SOCIAL_EPOCH) % SOCIAL_STEP_MS);
      timeout = window.setTimeout(() => {
        setCount(SOCIAL_BASE + solvedCount());
        setBump(true);
        setTimeout(() => setBump(false), 3000);
        schedule();
      }, untilNext + 1000);
    };
    schedule();
    return () => clearTimeout(timeout);
  }, []);

  return { count, bump };
}

/* ═══════════════════════════════════════════════════════════════════════
   1. STICKY HEADER
   ═══════════════════════════════════════════════════════════════════════ */

function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-white/8 bg-[#121216]/80 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:px-8 sm:py-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight text-white">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 sm:flex">
          <a href="#how" className="text-sm font-medium text-white/70 transition-colors hover:text-white">
            Fonctionnalités
          </a>
          <a href="#pricing" className="text-sm font-medium text-white/70 transition-colors hover:text-white">
            Tarifs
          </a>
          <a href="#testimonials" className="text-sm font-medium text-white/70 transition-colors hover:text-white">
            Avis
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to="/auth?returnTo=%2Fdashboard"
            className="hidden text-sm font-medium text-white/80 transition-colors hover:text-white sm:block"
          >
            Connexion
          </Link>
          <Link
            to="/auth?mode=guest&returnTo=%2Fscanner"
            className="group inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.03] hover:shadow-xl sm:px-5 sm:py-2.5 sm:text-sm"
          >
            Scanner →
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* PhoneMockup et HeroPhoneWidget importés depuis @/components/PhoneFrame */

/* HeroPhoneWidget importé depuis @/components/PhoneFrame */

function Hero() {
  const { count, bump } = useSocialCounter();

  return (
    <section className="relative isolate min-h-[100svh] overflow-hidden pt-20">
      {/* Background glow */}
      
      <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:pt-20">
        {/* Left: Text */}
        <div className="text-center lg:text-left">
          <Reveal>
            <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white/90">
              <Sparkles className="size-3.5 text-amber-300" />
              IA vision · lit ta photo d'exercice · Collège &amp; Lycée
            </span>
          </Reveal>

          <Reveal delay={0.1}>
            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ton devoir.
              <br />
              Ton IA.
              <br />
              <span className="text-brand-gradient">Ta prochaine bonne note.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-5 max-w-lg text-base leading-7 text-white/70 sm:text-lg">
              Upload une photo d'exercice. L'IA lit, comprend et te donne la réponse, l'explication complète ou une fiche de révision — en quelques secondes.
            </p>
          </Reveal>

          {/* Social counter */}
          <Reveal delay={0.25}>
            <p className="mt-4 flex items-center gap-1.5 text-sm font-medium text-white/60 lg:justify-start">
              <Flame className="size-4 text-orange-400" />
              <span className="tabular-nums">{count.toLocaleString("fr-FR")}</span> exercices résolus aujourd&apos;hui
              <AnimatePresence>
                {bump && (
                  <motion.span
                    initial={{ opacity: 0, y: 6, scale: 0.7 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="rounded-full bg-orange-500/25 px-2 py-0.5 text-xs font-bold text-orange-300"
                  >
                    +50
                  </motion.span>
                )}
              </AnimatePresence>
            </p>
          </Reveal>

          {/* CTA */}
          <Reveal delay={0.3}>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
              <Link
                to="/auth?mode=guest&returnTo=%2Fscanner"
                className="group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-950/40 transition-all hover:scale-[1.03] hover:shadow-2xl sm:px-8 sm:py-4 sm:text-base"
              >
                <Camera className="size-5" />
                Scanner mon premier exercice
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                <Play className="size-4" />
                Voir la démo ↓
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.35}>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/55 lg:justify-start">
              <span className="inline-flex items-center gap-1">
                <Check className="size-3 text-mint-400" />
                Réponse en ~10s
              </span>
              <span className="inline-flex items-center gap-1">
                <Shield className="size-3" />
                Conforme RGPD
              </span>
              <span className="inline-flex items-center gap-1">
                <Lock className="size-3" />
                Sans engagement
              </span>
            </div>
          </Reveal>
        </div>

        {/* Right: Phone widget */}
        <Reveal delay={0.2} className="hidden lg:block">
          <HeroPhoneWidget />
        </Reveal>
      </div>

      {/* Chevron */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/40 sm:block">
        <ChevronDown className="size-6 animate-bounce" />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   3. COMMENT ÇA MARCHE
   ═══════════════════════════════════════════════════════════════════════ */

const STEPS = [
  {
    num: "01",
    icon: Camera,
    title: "Tu uploades ton exercice",
    text: "Photo depuis la galerie, capture d'écran ou drag & drop. PNG, JPG, WEBP. 5 Mo max.",
    timing: "~5 sec",
    emoji: "📸",
  },
  {
    num: "02",
    icon: ScanLine,
    title: "L'IA lit et comprend",
    text: "Vision IA détecte la matière, le niveau, la consigne et les données. Aucune saisie manuelle.",
    timing: "~10 sec",
    emoji: "✍️",
  },
  {
    num: "03",
    icon: Sparkles,
    title: "Tu obtiens ta réponse",
    text: "Réponse rapide, explication pas à pas ou fiche de révision — tu choisis. Résultat en secondes.",
    timing: "≈ 7 sec",
    emoji: "✦",
  },
];

function HowItWorks() {
  return (
    <section id="how" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Comment ça marche
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Trois étapes. <span className="text-brand-gradient">Zéro effort.</span>
          </h2>
        </div>
      </Reveal>

      <div className="relative mt-14 grid gap-8 sm:grid-cols-3">
        {/* Connector line (desktop) */}
        <div className="pointer-events-none absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-primary/30 via-primary/10 to-primary/30 sm:block" />

        {STEPS.map((step, i) => (
          <Reveal key={step.num} delay={i * 0.12}>
            <div className="glass-card group relative rounded-3xl p-7 text-center transition-transform hover:-translate-y-1">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3 py-0.5 text-[10px] font-bold text-white">
                Étape {step.num}
              </span>
              <div className="mx-auto mt-2 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                {step.emoji}
              </div>
              <h3 className="mt-4 text-lg font-bold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-mint-500/10 px-3 py-1 text-xs font-semibold text-mint-300">
                <Clock className="size-3" />
                {step.timing}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   4. DÉMO LIVE INTERACTIVE
   ═══════════════════════════════════════════════════════════════════════ */

type DemoMode = "quick" | "explain" | "revise";

const DEMO_CONTENT: Record<DemoMode, { label: string; emoji: string; color: string; content: string }> = {
  quick: {
    label: "Réponse rapide",
    emoji: "⚡",
    color: "from-indigo-500/20 to-indigo-500/5 border-indigo-500/30",
    content: "x = (−3 + √(9+12)) / 2 = (−3 + √21) / 2 ≈ 0.79\n\nRésultat final : x ≈ 0.79 ou x ≈ −3.79",
  },
  explain: {
    label: "Explication",
    emoji: "👨‍🏫",
    color: "from-coral-500/20 to-coral-500/5 border-coral-500/30",
    content: "Ce qu'on demande : résoudre 2x² + 3x − 7 = 0\n\n📌 Méthode : Identité remarquable ou formule quadratique\n\nÉtape 1 : Calculer Δ = b² − 4ac = 9 + 56 = 65\nÉtape 2 : √65 ≈ 8.06\nÉtape 3 : x = (−3 ± 8.06) / 4\n\n✅ Résultat : x ≈ 1.27 ou x ≈ −2.77\n\n⚠️ Erreur fréquence : oublier le signe − devant b",
  },
  revise: {
    label: "Fiche de révision",
    emoji: "📚",
    color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    content: "📐 Équations du 2nd degré\n\nFormule clé : x = (−b ± √Δ) / 2a\nΔ = b² − 4ac\n\n• Δ > 0 → 2 solutions\n• Δ = 0 → 1 solution\n• Δ < 0 → 0 solution\n\n📝 Exercice 1 : Résoudre x² − 5x + 6 = 0\n📝 Exercice 2 : Résoudre 2x² + x − 1 = 0\n📝 Exercice 3 : Trouver k tel que x² + kx + 4 = 0 ait 1 seule solution",
  },
};

function LiveDemo() {
  const [mode, setMode] = useState<DemoMode>("quick");

  return (
    <section id="demo" className="bg-white/5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Démo live
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Choisis ton mode. <span className="text-brand-gradient">L'IA fait le reste.</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Voilà un exercice réel. Change de mode et regarde le résultat s'adapter.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
          {/* Phone */}
          <Reveal delay={0.1} className="hidden lg:block">
            <DemoPhoneWidget
              mode={mode}
              exercise="Résoudre : 2x² + 3x − 7 = 0"
              content={
                mode === "quick"
                  ? { emoji: "⚡", label: "Réponse rapide", labelColor: "text-orange-400", text: DEMO_CONTENT[mode].content }
                  : mode === "explain"
                    ? { emoji: "👨‍🏫", label: "Explication", labelColor: "text-blue-400", text: DEMO_CONTENT[mode].content }
                    : { emoji: "📚", label: "Fiche de révision", labelColor: "text-emerald-400", text: DEMO_CONTENT[mode].content }
              }
            />
          </Reveal>

          {/* Mode selector + full content */}
          <div>
            <div className="flex flex-wrap gap-3">
              {(["quick", "explain", "revise"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`glass-card rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
                    mode === m
                      ? "ring-2 ring-primary bg-primary/15 text-white"
                      : "text-muted-foreground hover:text-white"
                  }`}
                >
                  {DEMO_CONTENT[m].emoji} {DEMO_CONTENT[m].label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={`mt-6 glass-card rounded-3xl border bg-gradient-to-br p-6 ${DEMO_CONTENT[mode].color}`}
              >
                <span className="text-sm font-bold text-primary">
                  {DEMO_CONTENT[mode].emoji} {DEMO_CONTENT[mode].label}
                </span>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-foreground/80">
                  {DEMO_CONTENT[mode].content}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   5. AVANT / APRÈS
   ═══════════════════════════════════════════════════════════════════════ */

const WITHOUT_ITEMS = [
  { text: "⏱ 20 min à fixer ton écran", detail: '"Salut ça va ?" → ghost en 2h' },
  { text: '"Je comprends pas cette formule"', detail: "→ reste bloqué sans solution" },
  { text: '"Je vais réviser plus tard..."', detail: "→ jamais fait, mauvaise note" },
];

const WITH_ITEMS = [
  { text: "✦ Réponse en 10 secondes", detail: "La méthode complète, étape par étape" },
  { text: "✦ Explication qui fait comprendre", detail: "Adaptée à ton niveau détecté" },
  { text: "✦ Fiche de révision générée", detail: "Prête pour le contrôle de demain" },
];

function BeforeAfter() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Avant / Après
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Du blocage à la compréhension. <span className="text-brand-gradient">En 10 secondes.</span>
          </h2>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        {/* Sans */}
        <Reveal delay={0.05}>
          <div className="glass-card rounded-3xl border border-red-500/20 p-7">
            <div className="flex items-center gap-2 text-red-400">
              <X className="size-5" />
              <span className="text-sm font-bold uppercase tracking-wide">Sans StudySnap</span>
            </div>
            <div className="mt-5 space-y-4">
              {WITHOUT_ITEMS.map((item) => (
                <div key={item.text} className="rounded-2xl border border-red-500/10 bg-red-500/5 p-4">
                  <p className="text-sm font-semibold text-foreground/80">{item.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">Plat, générique, oubliable.</p>
          </div>
        </Reveal>

        {/* Avec */}
        <Reveal delay={0.15}>
          <div className="glass-card rounded-3xl border border-mint-500/20 p-7">
            <div className="flex items-center gap-2 text-mint-400">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-bold uppercase tracking-wide">Avec StudySnap</span>
            </div>
            <div className="mt-5 space-y-4">
              {WITH_ITEMS.map((item) => (
                <div key={item.text} className="rounded-2xl border border-mint-500/10 bg-mint-500/5 p-4">
                  <p className="text-sm font-semibold text-foreground">{item.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-mint-300">Précis, pédagogique, impossible à ignorer.</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   6. DIFFÉRENCIATION — StudySnap vs ChatGPT
   ═══════════════════════════════════════════════════════════════════════ */

function Differentiation() {
  return (
    <section className="bg-white/5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Le côté humain
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Elle pense comme un <span className="text-brand-gradient">vrai prof</span>. Pas un bot.
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Même exercice. La différence entre une IA générique et une qui a vraiment lu ta photo.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {/* ChatGPT */}
          <Reveal delay={0.05}>
            <div className="glass-card rounded-3xl p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-white/10 text-lg">
                  🤖
                </div>
                <div>
                  <p className="text-sm font-bold">ChatGPT</p>
                  <p className="text-xs text-muted-foreground">générique</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-border/60 bg-white/5 p-4">
                <p className="text-sm leading-6 text-muted-foreground italic">
                  "L'équation du second degré se résout avec la formule quadratique. Remplacez a, b et c par les valeurs..."
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Générique", "Hors-contexte", "Pas de détection"].map((tag) => (
                  <span key={tag} className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs text-red-400">
                    ✗ {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* StudySnap */}
          <Reveal delay={0.15}>
            <div className="glass-card rounded-3xl p-7 ring-2 ring-primary/30">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-gradient text-lg">
                  ✦
                </div>
                <div>
                  <p className="text-sm font-bold">StudySnap</p>
                  <p className="text-xs text-mint-300">lit la photo</p>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-mint-500/20 bg-mint-500/5 p-4">
                <p className="text-sm leading-6 text-foreground">
                  "C&apos;est une équation du 2nd degré : 2x² + 3x − 7 = 0. Δ = 9 + 56 = 65. Deux solutions : x ≈ 1.27 et x ≈ −2.77. Évite d&apos;oublier le signe − devant b."
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Lit la photo OCR", "Détecte la matière", "Adapté au niveau"].map((tag) => (
                  <span key={tag} className="rounded-full border border-mint-500/20 bg-mint-500/10 px-3 py-1 text-xs text-mint-300">
                    ✓ {tag}
                  </span>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.2}>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Derrière chaque réponse, une <strong className="text-foreground">méthode en 2 étapes</strong> : l'IA lit ta photo (OCR vision), puis raisonne sur le contenu pour produire une réponse adaptée — pas un template recyclé.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   7. POURQUOI STUDYSNAP — 3 features
   ═══════════════════════════════════════════════════════════════════════ */

const FEATURES = [
  {
    icon: Cpu,
    title: "Vision IA",
    text: "L'IA lit vraiment la photo d'exercice — pas juste du texte copié-collé. OCR + raisonnement en 2 étapes.",
    check: "Maths, Physique, SVT, Français…",
  },
  {
    icon: Zap,
    title: "3 modes en 1 clic",
    text: "Réponse rapide pour vérifier, explication pour comprendre, révision pour retenir. Le même scan, 3 utilités.",
    check: "Change de mode à tout moment",
  },
  {
    icon: Clock,
    title: "Résultat en secondes",
    text: "Upload photo → résultat en ~10 secondes. Pas de blank page, pas d'attente interminable.",
    check: "Plus rapide que de chercher alone",
  },
];

function WhyStudySnap() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Pourquoi StudySnap
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Pas un chatbot. <span className="text-brand-gradient">Un assistant de révision.</span>
          </h2>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={i * 0.1}>
            <div className="glass-card group rounded-3xl p-7 transition-transform hover:-translate-y-1">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <f.icon className="size-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{f.text}</p>
              <div className="mt-4 flex items-center gap-2 text-xs text-mint-300">
                <Check className="size-3.5" />
                {f.check}
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   8. TÉMOIGNAGES
   ═══════════════════════════════════════════════════════════════════════ */

const TESTIMONIALS = [
  { name: "Léa", city: "Lyon", stars: 5, text: "Je suis passée de 9 à 13 en maths en un trimestre. Le mode Explication m'a enfin fait comprendre les fonctions.", color: "bg-indigo-500" },
  { name: "Théo", city: "Paris", stars: 5, text: "Je gagne au moins une heure de révision chaque soir. Je scanne, je comprends la méthode, fini de recopier.", color: "bg-amber-500" },
  { name: "Sofia", city: "Marseille", stars: 5, text: "Les fiches de révision générées depuis mes cours de physique sont devenues ma seule méthode avant les contrôles.", color: "bg-rose-500" },
  { name: "Yanis", city: "Toulouse", stars: 4, text: "J'étais bloqué sur la factorisation depuis des semaines. L'explication étape par étape a tout débloqué en 5 min.", color: "bg-emerald-500" },
  { name: "Camille", city: "Bordeaux", stars: 5, text: "Beaucoup moins de stress avant les contrôles : je sais qu'en cas de blocage, j'ai une explication claire sous la main.", color: "bg-sky-500" },
  { name: "Nathan", city: "Lille", stars: 5, text: "Les mini quiz m'ont fait progresser plus que tous mes exercices de manuel. Le feedback immédiat change tout.", color: "bg-violet-500" },
];

function Testimonials() {
  return (
    <section id="testimonials" className="bg-white/5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Ils l'utilisent
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Des résultats concrets, <span className="text-brand-gradient">racontés par des élèves</span>
            </h2>
          </div>
        </Reveal>

        <div className="snap-row mt-12 flex gap-5 overflow-x-auto pb-4">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.name} delay={(i % 3) * 0.08}>
              <div className="glass-card w-[280px] shrink-0 snap-start rounded-3xl p-6">
                <div className="flex items-center gap-3">
                  <div className={`flex size-11 items-center justify-center rounded-full text-sm font-bold text-white ${t.color}`}>
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.city}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, s) => (
                    <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">« {t.text} »</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground/80">
          * Avis présentés à titre d&apos;illustration basés sur des retours d&apos;utilisateurs
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   9. TARIFS — Credit packs (sans abonnement)
   ═══════════════════════════════════════════════════════════════════════ */

const PACKS = [
  {
    name: "Pack Découverte",
    price: "1,99 €",
    credits: "5 crédits",
    highlight: false,
    features: ["5 analyses complètes", "Explication ou fiche au choix", "Sans engagement"],
  },
  {
    name: "Pack Standard",
    price: "4,99 €",
    credits: "15 crédits",
    highlight: true,
    tag: "★ Meilleur choix",
    features: ["15 analyses complètes", "Tous les modes disponibles", "Meilleur rapport qualité/prix", "Crédits sans expiration"],
  },
  {
    name: "Pack Gros besoin",
    price: "9,99 €",
    credits: "40 crédits",
    highlight: false,
    features: ["40 analyses complètes", "Idéal pour une période de révision", "Économie de 50%", "Crédits sans expiration"],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Tarifs
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Prix simples, <span className="text-brand-gradient">sans surprise.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Réponse rapide toujours gratuite. Achète des crédits quand tu en as besoin — pas d'abonnement.
          </p>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {PACKS.map((pack, i) => (
          <Reveal key={pack.name} delay={i * 0.1}>
            <div
              className={`glass-card relative flex flex-col rounded-3xl p-7 ${
                pack.highlight ? "ring-2 ring-primary/50" : ""
              }`}
            >
              {pack.tag && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-lg">
                  {pack.tag}
                </span>
              )}
              <h3 className="text-lg font-bold">{pack.name}</h3>
              <p className="mt-5">
                <span className="text-4xl font-black tracking-tight">{pack.price}</span>
              </p>
              <p className="mt-1 text-sm font-semibold text-primary">{pack.credits}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {pack.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-mint-500" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth?returnTo=%2Fpricing"
                className={`mt-7 rounded-full px-6 py-3 text-center text-sm font-semibold transition-all ${
                  pack.highlight
                    ? "bg-brand-gradient text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
                    : "border border-border bg-white/8 text-foreground hover:bg-white/15"
                }`}
              >
                Choisir ce pack
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Guarantees */}
      <Reveal delay={0.3}>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5" /> Paiement sécurisé Stripe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Shield className="size-3.5" /> Remboursé sous 14 jours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Target className="size-3.5" /> Sans engagement
          </span>
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   10. FAQ
   ═══════════════════════════════════════════════════════════════════════ */

const FAQ_ITEMS = [
  {
    q: "Est-ce que ça triche pour moi ?",
    a: "Non. StudySnap t'explique la méthode et les étapes pour résoudre l'exercice par toi-même. C'est un outil de compréhension, pas de copie. L'objectif est que tu comprennes la démarche pour être capable de refaire l'exercice seul.",
  },
  {
    q: "Ça marche sur quelles matières ?",
    a: "Toutes les matières du collège au lycée : Mathématiques, Physique-Chimie, SVT, Français, Histoire-Géographie, Anglais, et bien d'autres. L'IA détecte automatiquement la matière et le niveau.",
  },
  {
    q: "Mes photos sont privées ?",
    a: "Oui. Les photos sont stockées de façon sécurisée, supprimées automatiquement après 30 jours, et les liens d'accès sont temporaires. StudySnap respecte la vie privée des étudiants et ne partage jamais les images.",
  },
  {
    q: "Comment résilier / arrêter ?",
    a: "Il n'y a pas d'abonnement — tu achètes des crédits une seule fois. Pas de prélèvement automatique, pas de résiliation nécessaire. Tes crédits n'expirent jamais.",
  },
  {
    q: "Quelle différence avec ChatGPT ?",
    a: "ChatGPT ne voit pas ta photo et te donne des réponses génériques. StudySnap utilise une IA vision pour analyser le contexte réel de ton exercice (matière, niveau, données), puis génère une réponse adaptée au programme scolaire français.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Écris-nous à support@studysnap.app depuis l'adresse liée à ton compte. On répond sous 24h en semaine.",
  },
];

function FAQ() {
  return (
    <section id="faq" className="bg-white/5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              ❓ FAQ
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Questions fréquentes
            </h2>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <Accordion type="single" collapsible className="mt-10 space-y-4">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.q}
                value={`faq-${i}`}
                className="glass-card rounded-2xl border border-white/10 px-5"
              >
                <AccordionTrigger className="py-5 text-base font-semibold hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-6 text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CTA FINAL + FOOTER + SOCIAL NOTIFICATION
   ═══════════════════════════════════════════════════════════════════════ */

const SOCIAL_NOTIFICATIONS = [
  { name: "Léa", city: "Lyon", action: "vient de scanner un exercice de maths", time: "il y a 2 min" },
  { name: "Théo", city: "Paris", action: "a créé une fiche de révision", time: "il y a 5 min" },
  { name: "Sofia", city: "Marseille", action: "a terminé un quiz de physique", time: "il y a 8 min" },
  { name: "Yanis", city: "Toulouse", action: "a obtenu 14/20 grâce à StudySnap", time: "il y a 12 min" },
  { name: "Camille", city: "Bordeaux", action: "vient de scanner un exercice de SVT", time: "il y a 3 min" },
];

function SocialNotification() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = () => {
      setVisible(true);
      setTimeout(() => setVisible(false), 4000);
      setIndex((prev) => (prev + 1) % SOCIAL_NOTIFICATIONS.length);
    };
    // Initial delay
    const first = setTimeout(show, 5000);
    const iv = setInterval(show, 12000);
    return () => {
      clearTimeout(first);
      clearInterval(iv);
    };
  }, []);

  const n = SOCIAL_NOTIFICATIONS[index];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 20, x: "-50%" }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 left-1/2 z-40 glass-card flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl shadow-black/30 sm:left-auto sm:right-6 sm:translate-x-0"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {n.name[0]}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">
              {n.name} · {n.city} — <span className="text-muted-foreground font-normal">{n.action}</span>
            </p>
            <p className="text-[10px] text-muted-foreground/70">{n.time}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
      <Reveal>
        <div className="glass-panel relative overflow-hidden rounded-[2.5rem] px-6 py-14 text-center sm:px-12">
          <div className="absolute -left-16 -top-16 size-64 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 -right-10 size-64 rounded-full bg-coral-500/15 blur-3xl" />
          <GraduationCap className="mx-auto size-10 text-primary" />
          <h2 className="relative mt-5 text-3xl font-black tracking-tight sm:text-4xl">
            Ta prochaine{" "}
            <span className="text-brand-gradient">réponse parfaite.</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            Réponse rapide toujours gratuite. Packs de crédits à partir de 1,99 €. Sans abonnement, sans engagement.
          </p>
          <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              to="/auth?mode=guest&returnTo=%2Fscanner"
              className="group inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:brightness-110 sm:px-8 sm:py-4 sm:text-base"
            >
              <Camera className="size-4 sm:size-5" />
              Scanner gratuitement
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 sm:size-5" />
            </Link>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/15 sm:px-6 sm:py-4"
            >
              <ListChecks className="size-4" />
              Voir les tarifs
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/70 bg-white/4">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        {/* Use cases line */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>CAS D&apos;USAGE</span>
          <span className="text-border">·</span>
          <a href="#" className="transition-colors hover:text-foreground">Scanner un exercice</a>
          <span className="text-border">·</span>
          <a href="#" className="transition-colors hover:text-foreground">Créer une fiche</a>
          <span className="text-border">·</span>
          <a href="#" className="transition-colors hover:text-foreground">Réviser avant un contrôle</a>
          <span className="text-border">·</span>
          <a href="#" className="transition-colors hover:text-foreground">Suivre sa progression</a>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="text-lg font-extrabold tracking-tight">
              Study<span className="text-brand-gradient">Snap</span>
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/auth?returnTo=%2Fscanner" className="transition-colors hover:text-foreground">Scanner un exercice</Link>
            <Link to="/auth?returnTo=%2Fsheets" className="transition-colors hover:text-foreground">Créer une fiche</Link>
            <Link to="/auth?returnTo=%2Frevision" className="transition-colors hover:text-foreground">Réviser</Link>
            <Link to="/auth?returnTo=%2Fprogress" className="transition-colors hover:text-foreground">Progression</Link>
          </nav>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link to="/legal/cgu" className="hover:text-foreground">CGU</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Politique de confidentialité</Link>
            <Link to="/legal/mentions-legales" className="hover:text-foreground">Mentions légales</Link>
            <Link to="/legal/contact" className="hover:text-foreground">Contact</Link>
          </div>
          <p className="text-xs text-muted-foreground/80">
            © {new Date().getFullYear()} StudySnap. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen overflow-x-clip bg-background text-foreground"
      id="top"
    >
      <StickyHeader />
      <Hero />
      <HowItWorks />
      <LiveDemo />
      <BeforeAfter />
      <Differentiation />
      <WhyStudySnap />
      <Testimonials />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
      <SocialNotification />

      {/* Hidden SEO content — visible to crawlers only */}
      <div
        aria-hidden="true"
        className="sr-only"
        style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", borderWidth: 0 }}
      >
        <h2>StudySnap — Application IA pour scanner des exercices scolaires</h2>
        <p>
          StudySnap est la meilleure application web mobile-first pour scanner un exercice scolaire avec son téléphone et obtenir instantanément la réponse grâce à l'intelligence artificielle. Conçue pour les lycéens et collégiens de France, StudySnap transforme une simple photo d'exercice en réponse détaillée, explication pédagogique complète ou fiche de révision personnalisée.
        </p>
        <h3>Scanner exercice IA gratuit</h3>
        <p>
          Avec StudySnap, tu peux scanner n'importe quel exercice de mathématiques, physique-chimie, SVT, français, histoire-géographie ou anglais. Il te suffit de prendre en photo ton devoir avec ton téléphone, de l'importer dans l'application, et l'IA détecte automatiquement la matière, le niveau et la consigne. En quelques secondes, tu obtiens la réponse à ton exercice.
        </p>
        <h3>Résolution d'exercices par IA</h3>
        <p>
          Le mode Réponse rapide te donne la solution finale en une phrase. Le mode Explication te détaille la méthode complète avec des étapes numérotées. Le mode Révision te génère une mini-leçon, formules clés, exercices similaires et un quiz interactif.
        </p>
        <h3>Fiche de révision IA</h3>
        <p>
          StudySnap peut transformer tes cours en fiches de révision personnalisées contenant concepts, formules, méthodes, exemple type, pièges à éviter et essentiel à retenir.
        </p>
        <h3>Gratuit et sans engagement</h3>
        <p>
          Réponse rapide toujours gratuite. Packs de crédits payants à partir de 1,99 € sans abonnement. StudySnap est l'alternative française à Photomath.
        </p>
      </div>
    </motion.div>
  );
}
