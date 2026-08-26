import { AppShell } from "@/components/app-shell";
import { Markdown } from "@/components/markdown";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  FileDown,
  FileText,
  Lightbulb,
  ListOrdered,
  Loader2,
  Save,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRoundPlus,
  Volume2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAiErrorMessage } from "@/lib/ai-errors";
import { levelLabel, subjectEmoji } from "@/lib/format";
import { MaskedBlock, UnlockCard, useIsPaid } from "@/components/UnlockGate";
import { buildPdf, downloadPdf, markdownToPlainText, type PdfBlock } from "@/lib/pdf";
import type { GatedDocument } from "@/lib/document";
import type { Id } from "@/convex/_generated/dataModel";

type ViewMode = "answer" | "course";

/** Toggle « Réponse directe / Cours complet » pour un exercice. */
function ExerciseToggle({
  number,
  question,
  answer,
  calculation,
  explain,
  defaultMode = "answer",
}: {
  number: number;
  question: string;
  answer: string;
  calculation?: string;
  explain: {
    question: string;
    importantInfo: string[];
    method: string;
    steps: string[];
    result: string;
    commonMistake: string;
  };
  defaultMode?: ViewMode;
}) {
  const [view, setView] = useState<ViewMode>(defaultMode);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 p-5 sm:p-6">
      {/* En-tête exercice */}
      <div className="flex items-start gap-3">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {number}
        </span>
        <p className="min-w-0 flex-1 text-sm font-semibold leading-6">
          <Markdown content={question} />
        </p>
      </div>

      {/* Toggle */}
      <div className="mt-4 ml-9 flex gap-1 rounded-xl bg-white/8 p-1">
        <button
          type="button"
          onClick={() => setView("answer")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
            view === "answer"
              ? "bg-mint-500/15 text-mint-300 shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap className="size-3.5" />
          Réponse directe
        </button>
        <button
          type="button"
          onClick={() => setView("course")}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all",
            view === "course"
              ? "bg-primary/15 text-primary shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <BookOpen className="size-3.5" />
          Cours complet
        </button>
      </div>

      {/* Contenu */}
      <div className="mt-4 ml-9">
        {view === "answer" ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-mint-500/10 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-mint-300">
                ✓ Réponse
              </p>
              <div className="mt-1 text-sm leading-6">
                <Markdown content={answer} />
              </div>
            </div>
            {calculation && (
              <div className="rounded-xl bg-white/5 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Calcul essentiel
                </p>
                <p className="mt-1 text-sm leading-6">
                  <Markdown content={calculation} />
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
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
            <Section icon={<ListOrdered className="size-4" />} title="Étapes">
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
            <Section icon={<AlertTriangle className="size-4" />} title="Erreur fréquente" tone="warn">
              <p className="text-sm leading-6">
                <Markdown content={explain.commonMistake} />
              </p>
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

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
          ? "border-mint-500/30 bg-mint-500/10"
          : tone === "warn"
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-white/10 bg-white/6",
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
    <div className="rounded-2xl border border-white/10 bg-white/6 p-5">
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
        <div className="mt-3 ml-9 space-y-2 rounded-xl bg-white/10 p-4">
          <div className="text-sm">
            <span className="font-bold text-mint-300">✓ Réponse : </span>
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
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const isPaid = useIsPaid();
  const isGuest = user?.isAnonymous === true;

  const activeText = useMemo(() => {
    const r = scan?.result;
    if (!r) return "";
    // Texte pour copie : on concatène toutes les réponses.
    const parts: string[] = [];
    const doc = r.document as GatedDocument | undefined;
    if (doc?.exercises?.length) {
      for (const ex of doc.exercises) {
        parts.push(`Exercice ${ex.number} : ${ex.question}`);
        parts.push(`Réponse : ${ex.answer}`);
        if (ex.calculation) parts.push(`Calcul : ${ex.calculation}`);
        parts.push("");
      }
    } else {
      parts.push(r.quick.answer, r.quick.calculation);
    }
    // Ajout de l'explication détaillée.
    parts.push("--- EXPPLICATION ---");
    parts.push(
      [
        r.explain.question,
        ...r.explain.importantInfo,
        r.explain.method,
        ...r.explain.steps,
        r.explain.result,
        r.explain.commonMistake,
      ].join("\n"),
    );
    return parts.join("\n");
  }, [scan]);

  const handleFeedback = async (useful: boolean) => {
    if (!scan) return;
    setFeedbackSent(useful ? "yes" : "no");
    try {
      await setFeedback({ scanId: scan._id, useful });
      toast.success("Merci pour ton retour !");
    } catch (e) {
      // Échec d'enregistrement du retour : on remet le bouton à zéro pour
      // laisser réessayer — jamais de rejet non capté.
      console.error("Enregistrement du retour impossible :", e);
      setFeedbackSent(null);
      toast.error("Impossible d'enregistrer ton retour pour l'instant.");
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeText);
      toast.success("Copié dans le presse-papiers");
    } catch {
      // L'API Clipboard peut être indisponible (iframe sandbox, contexte non
      // sécurisé, permissions refusées) : repli sur une sélection de texte
      // programmée. Si même le repli échoue, on guide l'utilisateur au lieu
      // de laisser l'action planter.
      try {
        const ta = document.createElement("textarea");
        ta.value = activeText;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        ta.remove();
        if (ok) {
          toast.success("Copié dans le presse-papiers");
          return;
        }
        throw new Error("execCommand('copy') indisponible");
      } catch (err) {
        console.error("Copie impossible :", err);
        toast.error(
          "La copie automatique est bloquée par le navigateur — sélectionne le texte et copie-le manuellement (Ctrl+C / Cmd+C).",
        );
      }
    }
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

  /** Export PDF de marque du document complet corrigé (plan payant). */
  const handleExportPdf = () => {
    if (!scan?.result?.document || !isPaid) return;
    const doc = scan.result.document as GatedDocument;
    if (doc.locked) return;
    const blocks: PdfBlock[] = [
      { type: "h1", text: "Correction complète" },
      {
        type: "text",
        text: [scan.subject, levelLabel(scan.level), scan.topic].filter(Boolean).join(" · "),
      },
      { type: "divider" },
    ];
    for (const ex of doc.exercises) {
      blocks.push(
        { type: "h2", text: `Exercice ${ex.number}` },
        { type: "text", text: `Question : ${markdownToPlainText(ex.question)}` },
        { type: "text", text: `Réponse : ${markdownToPlainText(ex.answer)}` },
      );
      if (ex.calculation.trim()) {
        blocks.push({ type: "text", text: `Calcul : ${markdownToPlainText(ex.calculation)}` });
      }
      blocks.push({ type: "divider" });
    }
    const pdf = buildPdf({
      title: `StudySnap — ${scan.title}`,
      subtitle: `Correction complète · ${scan.subject} · ${levelLabel(scan.level)}`,
      blocks,
    });
    const safeName = (scan.title || "correction").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadPdf(pdf, `studysnap-${safeName}.pdf`);
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
  // Document complet corrigé : version payante (complète) ou aperçu gratuit
  // (premier exercice visible, locked=true — masqué côté serveur).
  const doc = scan.result.document as GatedDocument | undefined;
  const docExercises = doc?.exercises ?? [];
  const docLocked = doc?.locked === true;
  const totalExercises = doc?.totalExercises ?? docExercises.length;

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
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3.5 py-1.5 text-xs font-semibold text-amber-300">
            <AlertTriangle className="size-3.5" />
            Photo difficile à lire — vérifie la consigne
          </span>
        )}
      </div>

      {/* Contenu : un bloc par exercice avec toggle Réponse directe / Cours complet */}
      <div className="mt-5 space-y-4">
        {docExercises.length > 0 ? (
          docExercises.map((ex) => (
            <ExerciseToggle
              key={ex.number}
              number={ex.number}
              question={ex.question}
              answer={ex.answer}
              calculation={ex.calculation}
              explain={explain}
              defaultMode="answer"
            />
          ))
        ) : (
          /* Pas de document structuré : fallback sur le mode explain global */
          <ExerciseToggle
            number={1}
            question={explain.question}
            answer={quick.answer}
            calculation={quick.calculation}
            explain={explain}
            defaultMode="answer"
          />
        )}

        {/* Paywall : exercices verrouillés */}
        {docLocked && (
          <>
            <MaskedBlock label="Exercices suivants — réponses masquées" />
            <UnlockCard
              title={`${totalExercises - docExercises.length} exercice${
                totalExercises - docExercises.length > 1 ? "s" : ""
              } restant${totalExercises - docExercises.length > 1 ? "s" : ""} à débloquer`}
              description="Passe à Student ou Student Pro pour voir toutes les réponses détaillées et exporter le document corrigé en PDF."
            />
          </>
        )}

        {/* Export PDF — payants uniquement */}
        {!docLocked && docExercises.length > 0 && (
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 sm:w-auto"
          >
            <FileDown className="size-4" />
            Exporter le document en PDF
          </button>
        )}

        {/* Mini quiz */}
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
                ? "bg-mint-500/15 text-mint-300"
                : "hover:bg-white/15",
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
                ? "bg-rose-500/15 text-rose-400"
                : "hover:bg-white/15",
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
        {!isGuest && (
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
        )}
      </div>

      {/* Mode invité : paywall après le scan de démo — bloc complet qui
          explique que le scan gratuit est utilisé et pousse à la création
          de compte pour obtenir plus de crédits. */}
      {isGuest && (
        <div className="glass-panel mt-6 overflow-hidden rounded-3xl border border-primary/20">
          {/* Bandeau gradient en haut */}
          <div className="bg-brand-gradient px-6 py-4 text-center">
            <p className="text-sm font-bold text-white">
              ✨ Ton scan de démo est terminé
            </p>
          </div>
          <div className="p-6 text-center sm:p-8">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-7" />
            </div>
            <h3 className="mt-4 text-xl font-extrabold tracking-tight">
              Tu as utilisé ton scan gratuit
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Crée ton compte pour obtenir <strong className="text-foreground">4 scans gratuits par mois</strong>,
              garder ton historique, créer des fiches de révision et faire des quiz.
            </p>
            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
              {[
                { emoji: "⚡", text: "4 scans / mois" },
                { emoji: "📚", text: "Fiches de révision" },
                { emoji: "🎯", text: "Quiz sur mesure" },
                { emoji: "📊", text: "Suivi progression" },
              ].map((perk) => (
                <div
                  key={perk.text}
                  className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2.5 text-xs font-medium text-muted-foreground"
                >
                  <span>{perk.emoji}</span>
                  {perk.text}
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/auth?mode=signup&returnTo=/scanner"
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/25 transition-all hover:scale-[1.02] hover:brightness-110"
              >
                <UserRoundPlus className="size-4" />
                Créer mon compte — c'est gratuit
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-5 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
              >
                Revenir plus tard
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground/80">
              Inscription en 10 secondes · Juste ton email · Aucune carte bancaire
            </p>
          </div>
        </div>
      )}

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
