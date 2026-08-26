import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BookOpen, Camera, CheckCircle2, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";

const SCREENS = [
  {
    emoji: "👋",
    title: "Bienvenue sur StudySnap",
    text: "Ton assistant IA pour comprendre tes exercices, préparer tes contrôles et réviser efficacement.",
    gradient: "from-primary/20 to-coral-500/10",
    icon: Zap,
  },
  {
    emoji: "📸",
    title: "Importe une photo",
    text: "Scanne un exercice depuis ta galerie — l'IA lit l'énoncé, détecte la matière et le niveau en quelques secondes.",
    gradient: "from-mint-500/20 to-primary/10",
    icon: Camera,
  },
  {
    emoji: "📖",
    title: "Deux modes au choix",
    text: "Pour chaque exercice, bascule librement entre « Réponse directe » et « Cours complet » sans recharger.",
    gradient: "from-amber-500/20 to-primary/10",
    icon: BookOpen,
  },
  {
    emoji: "🚀",
    title: "C'est parti !",
    text: "Crée ton compte pour garder tes exercices, créer des fiches de révision et suivre ta progression.",
    gradient: "from-coral-500/20 to-primary/10",
    icon: CheckCircle2,
  },
] as const;

interface OnboardingTutorialProps {
  /** Called when the tutorial is dismissed (passer or last screen). */
  onDone: () => void;
  /** If true, the tutorial is a replay — never set hasSeenOnboarding. */
  isReplay?: boolean;
  /** Called to mark the tutorial as seen (sets hasSeenOnboarding=true). */
  markSeen?: () => void;
}

export function OnboardingTutorial({
  onDone,
  isReplay = false,
  markSeen,
}: OnboardingTutorialProps) {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  const total = SCREENS.length;
  const screen = SCREENS[step];
  const isLast = step === total - 1;

  const finish = useCallback(
    (goToScanner: boolean) => {
      if (!isReplay) markSeen?.();
      onDone();
      if (goToScanner) navigate("/scanner");
    },
    [isReplay, markSeen, onDone, navigate],
  );

  const next = () => {
    if (isLast) {
      finish(true);
    } else {
      setStep((s) => s + 1);
    }
  };

  const skip = () => finish(false);

  // Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only horizontal swipes (dx > |dy|) with sufficient distance.
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0 && !isLast) setStep((s) => s + 1); // swipe left → next
      if (dx > 0 && step > 0) setStep((s) => s - 1); // swipe right → prev
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      }
      if (e.key === "ArrowLeft" && step > 0) setStep((s) => s - 1);
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-background">
      {/* Background blobs */}
      <div className="pointer-events-none absolute -left-32 top-0 size-96 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-coral-500/10 blur-3xl" />

      {/* Skip button — top right */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5">
        <span className="text-lg font-extrabold tracking-tight">
          Study<span className="text-brand-gradient">Snap</span>
        </span>
        <button
          type="button"
          onClick={skip}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Passer
          <X className="size-4" />
        </button>
      </header>

      {/* Screen content */}
      <main
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-6"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex w-full max-w-sm flex-col items-center text-center"
          >
            {/* Icon */}
            <div
              className={cn(
                "flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br text-4xl",
                screen.gradient,
              )}
            >
              {screen.emoji}
            </div>

            {/* Title */}
            <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">
              {screen.title}
            </h1>

            {/* Text */}
            <p className="mt-4 max-w-xs text-base leading-7 text-muted-foreground">
              {screen.text}
            </p>

            {/* Step-specific illustrations */}
            {step === 1 && (
              <div className="mt-6 w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Camera className="size-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-semibold">Photo de ton devoir</p>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG, WEBP · jusqu&apos;à 6 photos
                    </p>
                  </div>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="mt-6 w-full max-w-xs space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-mint-500/30 bg-mint-500/10 px-4 py-3">
                  <Zap className="size-4 text-mint-300" />
                  <span className="text-sm font-semibold text-mint-300">
                    Réponse directe
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
                  <BookOpen className="size-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    Cours complet
                  </span>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Progress dots + CTA */}
      <footer className="relative z-10 px-6 pb-10 pt-4">
        {/* Dots */}
        <div className="mb-6 flex justify-center gap-2">
          {SCREENS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={cn(
                "size-2 rounded-full transition-all duration-300",
                i === step
                  ? "w-6 bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50",
              )}
              aria-label={`Écran ${i + 1}`}
            />
          ))}
        </div>

        {/* CTA button */}
        {isLast ? (
          <button
            type="button"
            onClick={() => finish(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-8 py-4 text-base font-bold text-white shadow-xl shadow-indigo-950/40 transition-all hover:scale-[1.02] hover:shadow-2xl"
          >
            Faire mon premier scan
            <ArrowRight className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={next}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-8 py-4 text-base font-bold text-foreground transition-all hover:bg-white/15"
          >
            Suivant
            <ArrowRight className="size-5" />
          </button>
        )}
      </footer>
    </div>
  );
}
