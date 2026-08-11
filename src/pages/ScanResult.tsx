import { AppShell } from "@/components/app-shell";
import { Markdown } from "@/components/markdown";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  Lightbulb,
  ListOrdered,
  Loader2,
  Save,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAiErrorMessage } from "@/lib/ai-errors";
import { levelLabel, subjectEmoji } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

type Mode = "quick" | "explain" | "revise";

const MODE_TABS: { id: Mode; label: string; emoji: string }[] = [
  { id: "quick", label: "Réponse rapide", emoji: "⚡" },
  { id: "explain", label: "Explication", emoji: "👨‍🏫" },
  { id: "revise", label: "Révision", emoji: "📚" },
];

function Section({
  icon,
  title,
  tone = "default",
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  tone?: "default" | "success" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        tone === "success"
          ? "border-mint-200/80 bg-mint-50/50"
          : tone === "warn"
            ? "border-amber-200/80 bg-amber-50/50"
            : "border-white/70 bg-white/60",
      )}
    >
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
        {icon}
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ExerciseCard({
  index,
  question,
  answer,
  hint,
}: {
  index: number;
  question: string;
  answer: string;
  hint: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>
        <p className="text-sm font-semibold leading-6">{question}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mt-3 ml-9 inline-flex items-center gap-1.5 text-xs font-bold text-primary"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
        {open ? "Masquer la correction" : "Voir la correction"}
      </button>
      {open && (
        <div className="mt-3 ml-9 space-y-2 rounded-xl bg-white/80 p-4">
          <div className="text-sm">
            <span className="font-bold text-mint-600">✓ Réponse : </span>
            <Markdown content={answer} />
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-primary">💡 Indice : </span>
            {hint}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ScanResult() {
  const { scanId } = useParams<{ scanId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(
    (searchParams.get("mode") as Mode) || "explain",
  );

  const scan = useQuery(api.scans.getScan, {
    scanId: scanId as Id<"scans">,
  });
  const setFeedback = useMutation(api.scans.setFeedback);
  const toggleSaved = useMutation(api.scans.toggleSaved);
  const generateSheet = useAction(api.ai.generateSheet);
  const createSheet = useMutation(api.revisionSheets.createSheet);

  const [feedbackSent, setFeedbackSent] = useState<"yes" | "no" | null>(null);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    const m = searchParams.get("mode") as Mode | null;
    if (m && (m === "quick" || m === "explain" || m === "revise")) {
      setMode(m);
    }
  }, [searchParams]);

  const activeText = useMemo(() => {
    const r = scan?.result;
    if (!r) return "";
    if (mode === "quick") {
      return `${r.quick.answer}\n\n${r.quick.calculation}\n\n${r.quick.keyPoint}`;
    }
    if (mode === "explain") {
      return [
        r.explain.question,
        ...r.explain.importantInfo,
        r.explain.method,
        ...r.explain.steps,
        r.explain.result,
        r.explain.commonMistake,
      ].join("\n");
    }
    return [r.revise.lesson, ...r.revise.keyFormulas].join("\n");
  }, [scan, mode]);

  const handleFeedback = async (useful: boolean) => {
    if (!scan) return;
    setFeedbackSent(useful ? "yes" : "no");
    await setFeedback({ scanId: scan._id, useful });
    toast.success("Merci pour ton retour !");
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeText);
    toast.success("Copié dans le presse-papiers");
  };

  const handleSpeak = () => {
    if (!("speechSynthesis" in window) || !activeText) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(activeText.replace(/[*$#`]/g, ""));
    utterance.lang = "fr-FR";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleAddToRevision = async () => {
    if (!scan) return;
    setCreatingSheet(true);
    try {
      const generated = await generateSheet({
        storageIds: scan.storageIds,
        contentTypes: scan.contentTypes,
        subject: scan.subject,
        level: scan.level,
      });
      const id = await createSheet({
        title: generated.title,
        subject: generated.subject,
        level: generated.level,
        sourceType: "scan",
        storageIds: scan.storageIds,
        content: generated.content,
      });
      toast.success("Fiche de révision créée !");
      navigate(`/sheets/${id}`);
    } catch (e) {
      console.error(e);
      toast.error(getAiErrorMessage(e) ?? "Impossible de créer la fiche pour l'instant.");
    } finally {
      setCreatingSheet(false);
    }
  };

  if (!scan || scan.status !== "done" || !scan.result) {
    return (
      <AppShell title="Résultat">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Chargement du résultat…
        </div>
      </AppShell>
    );
  }

  const d = scan.result.detection;
  const quick = scan.result.quick;
  const explain = scan.result.explain;
  const revise = scan.result.revise;

  return (
    <AppShell title={scan.title} subtitle="Résultat de ton scan">
      {/* Contexte */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-foreground">
          {subjectEmoji(scan.subject)}
          {scan.subject}
        </span>
        {scan.topic && (
          <span className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            {scan.topic}
          </span>
        )}
        <span className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          {levelLabel(scan.level)}
        </span>
        {!d.legible && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3.5 py-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="size-3.5" />
            Photo difficile à lire — vérifie la consigne
          </span>
        )}
      </div>

      {/* Onglets de mode */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {MODE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSearchParams({ mode: t.id })}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all",
              mode === t.id
                ? "bg-primary text-white shadow-md shadow-primary/25"
                : "glass-chip text-muted-foreground hover:text-foreground",
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Contenu */}
      <div className="mt-5 space-y-4">
        {mode === "quick" && (
          <>
            <Section icon={<Zap className="size-4" />} title="Réponse finale" tone="success">
              <p className="text-lg font-semibold leading-7">
                <Markdown content={quick.answer} />
              </p>
            </Section>
            <Section icon={<ListOrdered className="size-4" />} title="Calcul essentiel">
              <Markdown content={quick.calculation} />
            </Section>
            <Section icon={<Lightbulb className="size-4" />} title="À retenir">
              <p className="text-sm leading-6 text-muted-foreground">
                <Markdown content={quick.keyPoint} />
              </p>
            </Section>
          </>
        )}

        {mode === "explain" && (
          <>
            <Section icon={<Sparkles className="size-4" />} title="Ce qu'on demande">
              <p className="text-sm leading-6">
                <Markdown content={explain.question} />
              </p>
            </Section>
            <Section icon={<Lightbulb className="size-4" />} title="Infos importantes">
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-muted-foreground">
                {explain.importantInfo.map((info, i) => (
                  <li key={i}>{info}</li>
                ))}
              </ul>
            </Section>
            <Section icon={<BookOpen className="size-4" />} title="Méthode">
              <p className="text-sm leading-6">
                <Markdown content={explain.method} />
              </p>
            </Section>
            <Section icon={<ListOrdered className="size-4" />} title="Étapes numérotées">
              <ol className="space-y-3">
                {explain.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-6">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>
                      <Markdown content={step} />
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
            <Section icon={<Check className="size-4" />} title="Résultat" tone="success">
              <p className="text-lg font-bold">
                <Markdown content={explain.result} />
              </p>
            </Section>
            <Section
              icon={<AlertTriangle className="size-4" />}
              title="Erreur fréquente à éviter"
              tone="warn"
            >
              <p className="text-sm leading-6">
                <Markdown content={explain.commonMistake} />
              </p>
            </Section>
          </>
        )}

        {mode === "revise" && (
          <>
            <Section icon={<BookOpen className="size-4" />} title="Mini-leçon">
              <Markdown content={revise.lesson} />
            </Section>
            <Section icon={<Zap className="size-4" />} title="Formules clés">
              <ul className="space-y-2">
                {revise.keyFormulas.map((f, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 font-mono text-sm"
                  >
                    <Markdown content={f} />
                  </li>
                ))}
              </ul>
            </Section>
            <Section icon={<ListOrdered className="size-4" />} title="3 exercices similaires">
              <div className="space-y-3">
                {revise.exercises.map((ex, i) => (
                  <ExerciseCard key={i} index={i} {...ex} />
                ))}
              </div>
            </Section>
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-bold">Prêt·e à vérifier que c'est acquis ?</p>
                <p className="text-sm text-muted-foreground">
                  Génère un mini quiz sur cette notion.
                </p>
              </div>
              <Link
                to={`/revision?subject=${encodeURIComponent(scan.subject)}&topic=${encodeURIComponent(scan.topic ?? "")}`}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/25 transition-all hover:brightness-110"
              >
                <Sparkles className="size-4" />
                Créer un quiz
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="glass-card flex items-center gap-1 rounded-full p-1">
          <span className="px-2 text-xs font-medium text-muted-foreground">
            Utile ?
          </span>
          <button
            type="button"
            onClick={() => handleFeedback(true)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              feedbackSent === "yes"
                ? "bg-mint-100 text-mint-600"
                : "hover:bg-white/70",
            )}
            title="Utile"
          >
            <ThumbsUp className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => handleFeedback(false)}
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors",
              feedbackSent === "no"
                ? "bg-rose-100 text-rose-500"
                : "hover:bg-white/70",
            )}
            title="Pas utile"
          >
            <ThumbsDown className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors hover:text-foreground"
        >
          <Clipboard className="size-4" />
          Copier
        </button>
        <button
          type="button"
          onClick={handleSpeak}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
            speaking
              ? "bg-primary text-white"
              : "glass-chip hover:text-foreground",
          )}
        >
          <Volume2 className="size-4" />
          {speaking ? "Arrêter" : "Lire à voix haute"}
        </button>
        <button
          type="button"
          onClick={() => toggleSaved({ scanId: scan._id })}
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
            scan.saved
              ? "bg-primary/10 text-primary"
              : "glass-chip hover:text-foreground",
          )}
        >
          <Save className="size-4" />
          {scan.saved ? "Sauvegardé" : "Sauvegarder"}
        </button>
        <button
          type="button"
          onClick={handleAddToRevision}
          disabled={creatingSheet}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {creatingSheet ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <BookOpen className="size-4" />
          )}
          {creatingSheet ? "Création…" : "Ajouter aux révisions"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to="/exercises" className="font-semibold text-primary hover:underline">
          ← Tous mes exercices
        </Link>
        <Link to="/scanner" className="font-semibold text-primary hover:underline">
          Scanner un autre exercice →
        </Link>
      </div>
    </AppShell>
  );
}
