import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Flame,
  GraduationCap,
  History,
  ListChecks,
  Play,
  ScanLine,
  Smartphone,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";

/* ------------------------------------------------------------------ */
/* Hero — mosaïque de photos + overlay + compteur social               */
/* ------------------------------------------------------------------ */

const HERO_PHOTOS = [
  {
    src: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=900&q=70",
    alt: "Formules de mathématiques écrites à la main",
  },
  {
    src: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=70",
    alt: "Stylo sur une copie manuscrite",
  },
  {
    src: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=70",
    alt: "Cahier de notes ouvert",
  },
  {
    src: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=900&q=70",
    alt: "Pile de livres et de révisions",
  },
  {
    src: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=900&q=70",
    alt: "Salle de classe",
  },
];

function useSocialCounter() {
  const [count, setCount] = useState(12843);
  useEffect(() => {
    const target = 12843 + 47;
    const start = performance.now();
    const duration = 1800;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(Math.round(12843 + 47 * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return count;
}

function Hero() {
  const count = useSocialCounter();
  return (
    <section className="relative isolate min-h-[92svh] overflow-hidden">
      {/* Mosaïque de photos */}
      <div className="absolute inset-0 -z-10">
        <div className="grid h-full grid-cols-2 grid-rows-6 gap-1 sm:grid-cols-5 sm:grid-rows-2">
          <img
            src={HERO_PHOTOS[0].src}
            alt={HERO_PHOTOS[0].alt}
            className="col-span-2 row-span-3 h-full w-full object-cover sm:col-span-2 sm:row-span-2"
            loading="eager"
          />
          <img
            src={HERO_PHOTOS[1].src}
            alt={HERO_PHOTOS[1].alt}
            className="row-span-3 h-full w-full object-cover sm:row-span-1"
            loading="eager"
          />
          <img
            src={HERO_PHOTOS[2].src}
            alt={HERO_PHOTOS[2].alt}
            className="row-span-3 h-full w-full object-cover sm:row-span-2"
            loading="eager"
          />
          <img
            src={HERO_PHOTOS[3].src}
            alt={HERO_PHOTOS[3].alt}
            className="col-span-2 row-span-3 h-full w-full object-cover sm:col-span-1 sm:row-span-1"
            loading="eager"
          />
          <img
            src={HERO_PHOTOS[4].src}
            alt={HERO_PHOTOS[4].alt}
            className="col-span-2 row-span-3 h-full w-full object-cover sm:col-span-1 sm:row-span-1"
            loading="lazy"
          />
        </div>
        {/* Overlay sombre ~60% pour la lisibilité */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      </div>

      {/* Nav en overlay */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <img
            src={logo}
            alt="StudySnap"
            width={30}
            height={30}
            className="size-[30px] shrink-0 rounded-xl sm:size-[34px]"
          />
          <span className="truncate text-base font-extrabold tracking-tight text-white sm:text-lg">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
        <nav className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            to="/pricing"
            className="hidden text-sm font-medium text-white/80 transition-colors hover:text-white sm:block"
          >
            Pricing
          </Link>
          <Link
            to="/auth?returnTo=%2Fdashboard"
            className="hidden text-sm font-medium text-white/90 transition-colors hover:text-white sm:block"
          >
            Connexion
          </Link>
          <a
            href="#app-mobile"
            className="hidden items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white lg:flex"
          >
            <Smartphone className="size-4" />
            App mobile
          </a>
          <Link
            to="/auth?returnTo=%2Fdashboard"
            className="whitespace-nowrap rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 transition-all hover:shadow-xl hover:shadow-indigo-900/40 hover:brightness-110 sm:px-5 sm:py-2.5"
          >
            <span className="sm:hidden">Commencer</span>
            <span className="hidden sm:inline">Commencer gratuitement</span>
          </Link>
        </nav>
      </header>

      {/* Contenu centré */}
      <div className="mx-auto flex min-h-[78svh] w-full max-w-4xl flex-col items-center justify-center px-5 pb-20 pt-10 text-center sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-white/90">
            <Sparkles className="size-3.5 text-amber-300" />
            L'assistant IA des lycéens
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          Ton devoir.
          <br />
          Ton IA.
          <br />
          <span className="text-brand-gradient">Ta méthode.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="mt-6 max-w-xl text-base leading-7 text-white/85 sm:text-lg"
        >
          Scanne un exercice, comprends la méthode et transforme tes cours en
          fiches de révision personnalisées.
        </motion.p>

        {/* Compteur social live */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-white/75"
        >
          <Flame className="size-4 text-orange-400" />
          <span className="tabular-nums">{count.toLocaleString("fr-FR")}</span>{" "}
          exercices résolus aujourd&apos;hui
        </motion.p>

        {/* CTA principal */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
          className="mt-9 flex w-full flex-col items-center gap-4 sm:w-auto"
        >
          <Link
            to="/auth?returnTo=%2Fscanner"
            className="group inline-flex max-w-full items-center gap-2 whitespace-nowrap rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-950/40 transition-all hover:scale-[1.03] hover:shadow-2xl hover:shadow-indigo-950/50 sm:gap-2.5 sm:px-8 sm:py-4 sm:text-base"
          >
            <Camera className="size-4 shrink-0 sm:size-5" />
            Scanner mon premier exercice
            <ArrowRight className="size-4 shrink-0 transition-transform group-hover:translate-x-1 sm:size-5" />
          </Link>
          <Link
            to="/auth?returnTo=%2Fsheets"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
          >
            📚 Créer une fiche de révision
          </Link>
        </motion.div>
      </div>

      {/* Chevron scroll */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-white/50 sm:block">
        <ChevronDown className="size-6 animate-bounce" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                             */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    icon: Camera,
    title: "1 · Photo",
    text: "Scanne ton exercice ou importe une photo depuis ta galerie. Une ou plusieurs pages, sans recopier quoi que ce soit.",
  },
  {
    icon: ScanLine,
    title: "2 · Analyse IA",
    text: "L'IA détecte la matière, le niveau, la consigne et les données — en 2 à 4 secondes. Aucune saisie manuelle.",
  },
  {
    icon: Zap,
    title: "3 · Résultat",
    text: "Choisis ton mode : réponse rapide, explication pas à pas ou fiche de révision. Tu comprends la méthode, pas juste la réponse.",
  },
];

const MODES = [
  {
    emoji: "⚡",
    title: "Réponse rapide",
    text: "La réponse finale et le calcul essentiel, en une phrase claire. Parfait quand tu veux vérifier rapidement.",
    accent: "from-indigo-500/15 to-indigo-500/0 text-indigo-600",
  },
  {
    emoji: "👨‍🏫",
    title: "Explication",
    text: "Ce qu'on demande → infos importantes → méthode → étapes numérotées → résultat → erreur fréquente. Adapté à ton niveau.",
    accent: "from-coral-500/15 to-coral-500/0 text-coral-500",
  },
  {
    emoji: "📚",
    title: "Révision",
    text: "Mini-leçon sur la notion, formules clés, 3 exercices similaires et un mini quiz pour vérifier que c'est acquis.",
    accent: "from-emerald-500/15 to-emerald-500/0 text-emerald-600",
  },
];

const FAQ_ITEMS = [
  {
    q: "Comment scanner un exercice ?",
    a: "Depuis le tableau de bord, clique sur « Scanner un exercice », prends une photo de ton devoir (ou importe-la depuis ta galerie), puis valide. L'IA analyse la photo en 2 à 4 secondes et te propose ensuite le mode de réponse de ton choix.",
  },
  {
    q: "Comment fonctionnent les scans gratuits ?",
    a: "Le plan gratuit inclut 5 scans par mois, 3 fiches de révision et 3 quiz. Aucune carte bancaire n'est demandée. Quand tu atteins la limite, tu peux passer à Student ou Student Pro — ou attendre le mois suivant.",
  },
  {
    q: "Que faire si l'explication ne me convient pas ?",
    a: "Chaque résultat propose un bouton « utile / pas utile » : tes retours améliorent les réponses. Tu peux aussi relancer l'analyse avec une photo plus nette, choisir un autre mode (rapide / explication / révision), ou régler le niveau de détail de tes explications dans les paramètres.",
  },
  {
    q: "Comment annuler mon abonnement ?",
    a: "Depuis les Paramètres → Abonnement, clique sur « Gérer mon abonnement ». Tu es redirigé vers Stripe où tu peux annuler en un clic, sans engagement. Tu gardes l'accès jusqu'à la fin de la période payée.",
  },
  {
    q: "Mes photos de devoirs sont-elles stockées ?",
    a: "Les photos sont stockées de façon sécurisée pour te permettre de retrouver tes exercices, puis supprimées automatiquement après 30 jours (durée configurable). Tu peux supprimer un exercice à tout moment, et les liens d'accès aux images sont temporaires.",
  },
  {
    q: "Comment contacter le support ?",
    a: "Écris-nous à support@studysnap.app depuis l'adresse liée à ton compte. On répond généralement sous 24 h en semaine, et en priorité aux abonnés Student et Student Pro.",
  },
];

const TESTIMONIALS = [
  {
    name: "Léa",
    grade: "Terminale",
    stars: 5,
    text: "Je suis passée de 9 à 13 en maths en un trimestre. Le mode Explication m'a enfin fait comprendre les fonctions.",
    color: "bg-indigo-500",
  },
  {
    name: "Théo",
    grade: "Seconde",
    stars: 5,
    text: "Je gagne au moins une heure de révision chaque soir. Je scanne, je comprends la méthode, fini de recopier des corrections.",
    color: "bg-amber-500",
  },
  {
    name: "Sofia",
    grade: "Première",
    stars: 5,
    text: "Les fiches de révision générées depuis mes cours de physique sont devenues ma seule méthode de révision avant les contrôles.",
    color: "bg-rose-500",
  },
  {
    name: "Yanis",
    grade: "Terminale",
    stars: 4,
    text: "J'étais bloqué sur la factorisation depuis des semaines. L'explication étape par étape a tout débloqué en 5 minutes.",
    color: "bg-emerald-500",
  },
  {
    name: "Camille",
    grade: "Seconde",
    stars: 5,
    text: "Beaucoup moins de stress avant les contrôles : je sais qu'en cas de blocage, j'ai une explication claire sous la main.",
    color: "bg-sky-500",
  },
  {
    name: "Nathan",
    grade: "Première",
    stars: 5,
    text: "Les mini quiz m'ont fait progresser plus que tous mes exercices de manuel. Le feedback immédiat change tout.",
    color: "bg-violet-500",
  },
];

function SectionTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
        {kicker}
      </span>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-base leading-7 text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <SectionTitle
        kicker="Comment ça marche"
        title={
          <>
            De la photo à la méthode,{" "}
            <span className="text-brand-gradient">en 3 étapes</span>
          </>
        }
        subtitle="Le flux le plus court possible : tu scannes, l'IA analyse, tu choisis ton mode."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            className="glass-card rounded-3xl p-7"
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <step.icon className="size-6" />
            </div>
            <h3 className="mt-5 text-lg font-bold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Modes() {
  return (
    <section className="bg-white/50 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionTitle
          kicker="3 modes"
          title="Une réponse pour chaque besoin"
          subtitle="Réponse rapide pour vérifier, explication pour comprendre, révision pour retenir."
        />
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="glass-card group rounded-3xl p-7 transition-transform hover:-translate-y-1"
            >
              <div
                className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl ${mode.accent}`}
              >
                {mode.emoji}
              </div>
              <h3 className="mt-5 text-lg font-bold text-foreground">{mode.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{mode.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SheetPreview() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Fiches de révision
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Tes cours deviennent des{" "}
            <span className="text-brand-gradient">fiches claires et structurées</span>
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Importe une photo de cours, un PDF ou du texte : StudySnap génère
            automatiquement concepts, définitions, formules, méthodes, exemple
            type, pièges à éviter et l&apos;essentiel à retenir.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Concepts & définitions du chapitre",
              "Formules clés en LaTeX, prêtes pour le bac",
              "Exemple type corrigé pas à pas",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Link to="/auth?returnTo=%2Fsheets">
            <Button className="mt-8 rounded-full px-6">
              📚 Créer une fiche de révision
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </Link>
        </div>

        {/* Aperçu visuel d'une fiche */}
        <motion.div
          initial={{ opacity: 0, rotate: 1.5, y: 16 }}
          whileInView={{ opacity: 1, rotate: 0, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto w-full max-w-md"
        >
          <div className="glass-panel rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                📐 Mathématiques · Seconde
              </span>
              <span className="text-xs text-muted-foreground">Fiche n°1</span>
            </div>
            <h3 className="mt-4 text-lg font-bold">Équations du premier degré</h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-border/70 bg-white/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Définition
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Une équation du 1er degré s&apos;écrit ax + b = c avec a ≠ 0.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Formule clé
                </p>
                <p className="mt-1 font-mono text-sm">x = (c − b) / a</p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                  Exemple
                </p>
                <p className="mt-1 text-sm leading-5">
                  2x + 5 = 17 → 2x = 12 →{" "}
                  <span className="font-semibold text-foreground">x = 6</span>
                </p>
              </div>
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">
                  ⚠️ Piège
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  Oublier d&apos;appliquer l&apos;opération aux deux membres.
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 -top-4 -z-10 size-40 rounded-full bg-primary/20 blur-3xl" />
        </motion.div>
      </div>
    </section>
  );
}

function QuizPreview() {
  return (
    <section className="bg-white/50 py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
        {/* Aperçu d'une question de quiz */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="order-2 mx-auto w-full max-w-md lg:order-1"
        >
          <div className="glass-panel rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                ✅ Question 3 / 5
              </span>
              <span className="text-xs text-muted-foreground">Intermédiaire</span>
            </div>
            <p className="mt-4 text-base font-semibold leading-6">
              L&apos;équation 2x + 5 = 17 admet pour solution :
            </p>
            <div className="mt-4 space-y-2.5">
              {["x = 6", "x = 11", "x = 4", "x = 12"].map((opt, i) => (
                <div
                  key={opt}
                  className={`rounded-xl border px-4 py-3 text-sm ${
                    i === 0
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-border/80 bg-white/70 text-muted-foreground"
                  }`}
                >
                  <span className="mr-2 font-semibold">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                  {i === 0 && <span className="float-right text-emerald-600">✓</span>}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-primary/5 p-3.5 text-sm leading-5 text-primary">
              💡 2 × 6 + 5 = 17 : seule cette valeur vérifie l&apos;équation.
            </div>
          </div>
        </motion.div>

        <div className="order-1 lg:order-2">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
            Quiz générés
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Vérifie que c&apos;est vraiment acquis,{" "}
            <span className="text-brand-gradient">question par question</span>
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            StudySnap génère des quiz sur mesure : 5 à 20 questions, difficulté et
            type paramétrables (QCM, vrai-faux, réponse libre, problème). Feedback
            immédiat, explication à chaque réponse, et score final avec les notions
            à revoir.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Difficulté et types de questions au choix",
              "Feedback immédiat + explication pédagogique",
              "Notions faibles identifiées pour cibler ta révision",
            ].map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3" />
                </span>
                {f}
              </li>
            ))}
          </ul>
          <Link to="/auth?returnTo=%2Frevision">
            <Button className="mt-8 rounded-full px-6">
              <Play className="mr-2 size-4" />
              Faire un quiz d&apos;essai
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

function HistoryPreview() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <SectionTitle
        kicker="Historique"
        title="Tous tes exercices, au même endroit"
        subtitle="Retrouve chaque scan, filtre par matière, recherche par mot-clé, et replonge dans une explication à tout moment."
      />
      <div className="mx-auto mt-12 max-w-2xl space-y-3">
        {[
          {
            emoji: "📐",
            subject: "Mathématiques",
            title: "Théorème de Pythagore",
            when: "Aujourd'hui · 18:42",
            mode: "👨‍🏫 Explication",
          },
          {
            emoji: "⚗️",
            subject: "Physique-Chimie",
            title: "Loi d'Ohm",
            when: "Hier · 20:15",
            mode: "⚡ Réponse rapide",
          },
          {
            emoji: "📐",
            subject: "Mathématiques",
            title: "Factorisation — identités remarquables",
            when: "Lun. · 17:03",
            mode: "📚 Révision",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="glass-card flex items-center gap-4 rounded-2xl p-4"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
              {item.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.subject} · {item.when}
              </p>
            </div>
            <span className="hidden shrink-0 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
              {item.mode}
            </span>
            <History className="size-4 shrink-0 text-muted-foreground/60" />
          </div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="bg-white/50 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <SectionTitle
          kicker="Ils l'utilisent"
          title="Des résultats concrets, racontés par des lycéens"
        />
        <div className="snap-row mt-12 flex gap-5 overflow-x-auto pb-4">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 3) * 0.08, duration: 0.4 }}
              className="glass-card w-[290px] shrink-0 snap-start rounded-3xl p-6"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex size-11 items-center justify-center rounded-full text-sm font-bold text-white ${t.color}`}
                >
                  {t.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.grade}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <Star key={s} className="size-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                « {t.text} »
              </p>
            </motion.div>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground/80">
          * Avis présentés à titre d&apos;illustration basés sur des retours
          d&apos;utilisateurs
        </p>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-28">
      <SectionTitle
        kicker="Pricing"
        title="Commence gratuitement, upgrade quand tu veux"
        subtitle="Essaie l'app avec 5 scans gratuits par mois. Aucune carte demandée pour commencer."
      />
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {[
          {
            name: "Gratuit",
            price: "0 €",
            note: "/ mois",
            tagline: "Pour tester StudySnap sans engagement.",
            features: [
              "5 scans d'exercices / mois",
              "3 fiches de révision / mois",
              "Quiz limités (3 / mois)",
              "Les 3 modes de réponse",
            ],
            cta: "Commencer gratuitement",
            to: "/auth?returnTo=%2Fdashboard",
            highlight: false,
          },
          {
            name: "Student",
            price: "9,99 €",
            note: "/ mois",
            tagline: "L'essentiel pour réviser toute l'année.",
            features: [
              "Scans illimités (fair-use)",
              "Fiches de révision illimitées",
              "Quiz illimités (5-20 questions)",
              "Explications adaptées à ton niveau",
              "Support par email",
            ],
            cta: "Découvrir Student",
            to: "/pricing",
            highlight: true,
          },
          {
            name: "Student Pro",
            price: "14,99 €",
            note: "/ mois",
            tagline: "Pour les grosses révisions et le bac.",
            features: [
              "Tout le plan Student",
              "Analyse multi-pages (plusieurs photos)",
              "Statistiques avancées & progression",
              "Priorité IA (réponses plus rapides)",
              "Export PDF des fiches",
            ],
            cta: "Découvrir Student Pro",
            to: "/pricing",
            highlight: false,
          },
        ].map((plan) => (
          <div
            key={plan.name}
            className={`glass-card relative flex flex-col rounded-3xl p-7 ${
              plan.highlight ? "ring-2 ring-primary/50" : ""
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-4 py-1 text-xs font-bold text-white shadow-lg">
                Le plus choisi
              </span>
            )}
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <p className="mt-5">
              <span className="text-4xl font-black tracking-tight">{plan.price}</span>
              <span className="text-sm text-muted-foreground">{plan.note}</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              to={plan.to}
              className={`mt-7 rounded-full px-6 py-3 text-center text-sm font-semibold transition-all ${
                plan.highlight
                  ? "bg-brand-gradient text-white shadow-lg shadow-indigo-500/25 hover:brightness-110"
                  : "border border-border bg-white/70 text-foreground hover:bg-white"
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">
        Annulable à tout moment · Paiement sécurisé via Stripe · Les prix incluent la TVA
      </p>
    </section>
  );
}

function FAQ() {
  return (
    <section id="faq" className="bg-white/50 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
        <SectionTitle
          kicker="❓ FAQ"
          title="Questions fréquentes sur StudySnap"
        />
        <Accordion type="single" collapsible className="mt-10 space-y-4">
          {FAQ_ITEMS.map((item, i) => (
            <AccordionItem
              key={item.q}
              value={`item-${i}`}
              className="glass-card rounded-2xl border border-white/70 px-5"
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
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="app-mobile" className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
      <div className="glass-panel relative overflow-hidden rounded-[2.5rem] px-6 py-14 text-center sm:px-12">
        <div className="absolute -left-16 -top-16 size-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-20 -right-10 size-64 rounded-full bg-coral-500/15 blur-3xl" />
        <GraduationCap className="mx-auto size-10 text-primary" />
        <h2 className="relative mt-5 text-3xl font-black tracking-tight sm:text-4xl">
          Ton premier exercice scanné{" "}
          <span className="text-brand-gradient">en 10 secondes</span>
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          5 scans gratuits par mois, sans carte bancaire. Si tu aimes l&apos;expérience,
          passe à Student quand tu veux — ou pas.
        </p>
        <div className="relative mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/auth?returnTo=%2Fscanner"
            className="group inline-flex items-center gap-2.5 rounded-full bg-brand-gradient px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:brightness-110"
          >
            <Camera className="size-5" />
            Scanner gratuitement
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-6 py-4 text-sm font-semibold text-foreground transition-colors hover:bg-white"
          >
            <ListChecks className="size-4" />
            Voir les prix
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/70 bg-white/40">
      <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="StudySnap" width={28} height={28} className="rounded-lg" />
            <span className="text-base font-extrabold tracking-tight">
              Study<span className="text-brand-gradient">Snap</span>
            </span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#top" className="transition-colors hover:text-foreground">
              Scanner un exercice
            </a>
            <a href="#pricing" className="transition-colors hover:text-foreground">
              Créer une fiche
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              Réviser avant un contrôle
            </a>
            <Link to="/progress" className="transition-colors hover:text-foreground">
              Suivre sa progression
            </Link>
          </nav>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href="#" className="hover:text-foreground">CGU</a>
            <a href="#" className="hover:text-foreground">Politique de confidentialité</a>
            <a href="#" className="hover:text-foreground">Mentions légales</a>
            <a href="#" className="hover:text-foreground">Contact</a>
          </div>
          <p className="text-xs text-muted-foreground/80">
            © {new Date().getFullYear()} StudySnap. Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="bg-glow min-h-screen overflow-x-clip bg-background text-foreground"
      id="top"
    >
      <Hero />
      <HowItWorks />
      <Modes />
      <SheetPreview />
      <QuizPreview />
      <HistoryPreview />
      <Testimonials />
      <PricingSection />
      <FAQ />
      <FinalCTA />
      <Footer />
    </motion.div>
  );
}
