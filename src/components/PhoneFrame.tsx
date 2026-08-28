import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Composant réutilisable de mockup de téléphone réaliste.
 * Utilisé dans le hero et la section démo interactive de la landing page.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[280px] sm:w-[310px]">
      <div className="relative rounded-[3rem] bg-[#1a1a22] p-[3px] shadow-2xl shadow-black/50 ring-1 ring-white/10">
        {/* Outer bezel glow */}
        <div className="absolute -inset-0.5 rounded-[3rem] bg-gradient-to-br from-white/10 via-transparent to-white/5" />

        {/* Phone body */}
        <div className="relative overflow-hidden rounded-[2.85rem] bg-[#0c0c14]">
          {/* Dynamic Island / Notch */}
          <div className="flex justify-center pt-2.5 pb-1">
            <div className="h-[22px] w-[90px] rounded-full bg-black ring-1 ring-white/5" />
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-7 pb-1">
            <span className="text-[11px] font-semibold text-white/50">9:41</span>
            <div className="flex items-center gap-1.5">
              {/* Signal bars */}
              <div className="flex items-end gap-[2px]">
                <div className="h-1 w-[3px] rounded-sm bg-white/40" />
                <div className="h-1.5 w-[3px] rounded-sm bg-white/40" />
                <div className="h-2 w-[3px] rounded-sm bg-white/40" />
                <div className="h-2.5 w-[3px] rounded-sm bg-white/40" />
              </div>
              {/* Battery */}
              <div className="h-2.5 w-[18px] rounded-sm border border-white/30 p-[1px]">
                <div className="h-full w-[75%] rounded-[1px] bg-white/50" />
              </div>
            </div>
          </div>

          {/* Screen content */}
          <div className="bg-[#0f0f18]">{children}</div>

          {/* Bottom home indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="h-1 w-[100px] rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Header bannière gradient StudySnap pour l'intérieur du téléphone.
 */
function PhoneHeader() {
  return (
    <div className="mx-3 mb-2.5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#FF6B4A] px-3 py-2 text-center text-[11px] font-extrabold text-white shadow-md">
      StudySnap
    </div>
  );
}

/**
 * Bulle de message envoyé (exercice scanné).
 */
function PhoneUserBubble({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="self-end max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-[#4F46E5] to-[#FF6B4A] px-3 py-2 shadow-lg shadow-indigo-500/20"
    >
      <p className="text-[11px] font-medium leading-4 text-white">{text}</p>
    </motion.div>
  );
}

/**
 * Carte de résultat stylisée glassmorphism.
 */
function PhoneResultCard({
  emoji,
  label,
  labelColor,
  text,
  delay,
}: {
  emoji: string;
  label: string;
  labelColor: string;
  text: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm"
    >
      <span className={`text-[10px] font-bold ${labelColor}`}>
        {emoji} {label}
      </span>
      <p className="mt-1 text-[10px] leading-4 text-white/70">{text}</p>
    </motion.div>
  );
}

/**
 * Barre de navigation en bas du téléphone.
 */
function PhoneNavBar() {
  return (
    <div className="mx-3 mt-2.5 mb-1 flex items-center justify-around rounded-xl border border-white/8 bg-white/[0.04] py-2">
      <span className="text-[9px] text-white/30">🏠 Accueil</span>
      <span className="text-[9px] font-bold text-[#FF6B4A]">📷 Scanner</span>
      <span className="text-[9px] text-white/30">📚 Fiches</span>
    </div>
  );
}

/** Données des 3 résultats cascade */
const RESULT_CARDS = [
  {
    emoji: "⚡",
    label: "Réponse rapide",
    labelColor: "text-orange-400",
    text: "x = 1 ou x = −3",
    delay: 0.6,
  },
  {
    emoji: "👨‍🏫",
    label: "Explication",
    labelColor: "text-blue-400",
    text: "Divise par 3 : x² + 2x − 3 = 0. Discriminant Δ = 4 + 12 = 16. Deux solutions réelles.",
    delay: 1.0,
  },
  {
    emoji: "📚",
    label: "Révision",
    labelColor: "text-emerald-400",
    text: "Formule : x = (−b ± √Δ) / 2a avec Δ = b² − 4ac. 3 exercices similaires + quiz 5 QCM.",
    delay: 1.4,
  },
];

/**
 * Widget complet du hero : téléphone avec animation de scan → résultats cascade.
 */
export function HeroPhoneWidget() {
  return (
    <PhoneFrame>
      <div className="flex h-[420px] flex-col px-3 pb-1">
        <PhoneHeader />

        <div className="flex flex-1 flex-col justify-end gap-2">
          <PhoneUserBubble text="Résoudre : 3x² + 6x − 9 = 0" />

          <div className="flex flex-col gap-2">
            {RESULT_CARDS.map((card) => (
              <PhoneResultCard key={card.label} {...card} />
            ))}
          </div>
        </div>

        <PhoneNavBar />
      </div>
    </PhoneFrame>
  );
}

/**
 * Widget pour la section démo interactive : affiche un mode sélectionné avec crossfade.
 */
export function DemoPhoneWidget({
  mode,
  exercise,
  content,
}: {
  mode: string;
  exercise: string;
  content: { emoji: string; label: string; labelColor: string; text: string };
}) {
  return (
    <PhoneFrame>
      <div className="flex h-[420px] flex-col px-3 pb-1">
        <PhoneHeader />

        <div className="flex flex-1 flex-col justify-end gap-2">
          {/* Exercice scanné */}
          <div className="self-start rounded-2xl rounded-bl-md border border-white/8 bg-white/[0.04] px-3 py-2">
            <p className="text-[10px] text-white/50">{exercise}</p>
          </div>

          {/* Résultat avec crossfade */}
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="self-end rounded-2xl rounded-br-md border border-white/8 bg-white/[0.04] px-3 py-2.5 backdrop-blur-sm"
          >
            <span className={`text-[10px] font-bold ${content.labelColor}`}>
              {content.emoji} {content.label}
            </span>
            <p className="mt-1 text-[10px] leading-4 text-white/70">
              {content.text.length > 150 ? content.text.slice(0, 150) + "…" : content.text}
            </p>
          </motion.div>
        </div>

        <PhoneNavBar />
      </div>
    </PhoneFrame>
  );
}
