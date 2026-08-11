export function formatDateFr(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTimeFr(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return `${m} min ${s > 0 ? `${s} s` : ""}`.trim();
}

export function pluralFr(n: number, singular: string, plural?: string): string {
  return n > 1 ? (plural ?? `${singular}s`) : singular;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Pastilles matières adaptées au thème sombre (fond translucide, teinte claire). */
export const SUBJECT_COLORS: Record<string, string> = {
  "Mathématiques": "bg-indigo-500/15 text-indigo-300",
  "Physique-Chimie": "bg-sky-500/15 text-sky-300",
  "Français": "bg-rose-500/15 text-rose-300",
  "Histoire-Géo": "bg-amber-500/15 text-amber-300",
  "SVT": "bg-mint-500/15 text-mint-300",
  "Anglais": "bg-violet-500/15 text-violet-300",
  "Espagnol": "bg-orange-500/15 text-orange-300",
  "Philosophie": "bg-teal-500/15 text-teal-300",
  "NSI": "bg-cyan-500/15 text-cyan-300",
};

export function subjectColor(subject: string): string {
  return SUBJECT_COLORS[subject] ?? "bg-white/10 text-zinc-300";
}

export function subjectEmoji(subject: string): string {
  const map: Record<string, string> = {
    "Mathématiques": "📐",
    "Physique-Chimie": "⚗️",
    "Français": "📖",
    "Histoire-Géo": "🌍",
    "SVT": "🧬",
    "Anglais": "🇬🇧",
    "Espagnol": "🇪🇸",
    "Philosophie": "💭",
    "NSI": "💻",
  };
  return map[subject] ?? "📚";
}

export const LEVEL_LABELS: Record<string, string> = {
  college: "Collège",
  seconde: "Seconde",
  premiere: "Première",
  terminale: "Terminale",
  postbac: "Post-bac",
};

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level;
}

export const MODE_LABELS: Record<string, { label: string; emoji: string }> = {
  quick: { label: "Réponse rapide", emoji: "⚡" },
  explain: { label: "Explication", emoji: "👨‍🏫" },
  revise: { label: "Révision", emoji: "📚" },
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode]?.label ?? mode;
}

export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
};
