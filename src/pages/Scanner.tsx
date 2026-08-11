import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  FileImage,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAiErrorMessage } from "@/lib/ai-errors";
import type { ConvexError } from "convex/values";

type Step = "upload" | "analyzing" | "mode";

const MAX_FILES = 6;
const MAX_SIZE_MB = 10;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const ANALYSIS_STEPS = [
  "Lecture de la photo…",
  "Extraction de l'énoncé…",
  "Détection de la matière et du niveau…",
  "Préparation de tes explications…",
];

const MODES = [
  {
    id: "quick" as const,
    emoji: "⚡",
    title: "Réponse rapide",
    text: "La réponse finale + le calcul essentiel, en une phrase claire.",
    tag: "2 s",
  },
  {
    id: "explain" as const,
    emoji: "👨‍🏫",
    title: "Explication",
    text: "Ce qu'on demande → méthode → étapes numérotées → erreur fréquente.",
    tag: "Recommandé",
  },
  {
    id: "revise" as const,
    emoji: "📚",
    title: "Révision",
    text: "Mini-leçon, formules clés, 3 exercices similaires pour t'entraîner.",
    tag: "Pour retenir",
  },
];

function LimitReached() {
  return (
    <AppShell title="Limite gratuite atteinte" subtitle="Scanner">
      <div className="glass-panel mx-auto max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-lg shadow-indigo-500/25">
          🔥
        </div>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
          Tes 5 scans gratuits de ce mois sont utilisés
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Tu as adoré l'expérience — passe à Student ou Student Pro pour des
          scans illimités, des fiches illimitées et des quiz sur mesure. Tu
          gardes tes exercices, bien sûr.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            <Zap className="size-4" />
            Voir les offres Student
          </Link>
          <Link
            to="/exercises"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white"
          >
            Revoir mes exercices
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Les compteurs se réinitialisent au début du mois prochain.
        </p>
      </div>
    </AppShell>
  );
}

export default function Scanner() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [storageIds, setStorageIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const usage = useQuery(api.usage.getMyUsage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const analyzeImages = useAction(api.ai.analyzeImages);
  const recordScan = useMutation(api.scans.recordScan);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((list: FileList | File[]) => {
    const next = Array.from(list).filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        toast.error(`Format non supporté : ${f.name}`);
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name} dépasse ${MAX_SIZE_MB} Mo`);
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const remaining = MAX_FILES - prev.length;
      const kept = next.slice(0, Math.max(0, remaining));
      const added = kept.map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
      if (next.length > kept.length) {
        toast.info(`Maximum ${MAX_FILES} photos par analyse`);
      }
      return [...prev, ...added];
    });
  }, []);

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    setError(null);
    setStep("analyzing");
    const interval = setInterval(
      () => setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      950,
    );
    try {
      const storageIds: string[] = [];
      for (const f of files) {
        const postUrl = await generateUploadUrl();
        const res = await fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": f.file.type },
          body: f.file,
        });
        if (!res.ok) throw new Error("Upload impossible");
        const { storageId } = (await res.json()) as { storageId: string };
        storageIds.push(storageId);
      }
      const result = await analyzeImages({ storageIds, contentTypes: files.map((f) => f.file.type) });
      setAnalysis(result);
      setStorageIds(storageIds);
      setStep("mode");
    } catch (e) {
      console.error(e);
      const aiMsg = getAiErrorMessage(e);
      if (aiMsg) {
        toast.error(aiMsg);
      } else {
        const code = (e as ConvexError<{ code?: string }>)?.data?.code;
        if (code === "LIMIT_REACHED") {
          toast.error("Limite gratuite atteinte — passe à Student pour continuer.");
        } else if (code === "RATE_LIMITED") {
          toast.error("Un petit instant entre deux analyses…");
        } else {
          toast.error("L'analyse a échoué. Réessaie avec une photo plus nette.");
        }
      }
      setStep("upload");
    } finally {
      clearInterval(interval);
      setAnalysisStep(0);
    }
  };

  const handlePickMode = async (mode: "quick" | "explain" | "revise") => {
    if (!analysis) return;
    try {
      const scanId = await recordScan({
        storageIds,
        contentTypes: files.map((f) => f.file.type),
        analysis: analysis as never,
        mode,
      });
      navigate(`/scanner/result/${scanId}?mode=${mode}`);
    } catch (e) {
      const code = (e as ConvexError<{ code?: string }>)?.data?.code;
      if (code === "LIMIT_REACHED") {
        toast.error("Limite gratuite atteinte — passe à Student pour continuer.");
      } else {
        toast.error("Impossible d'enregistrer le scan.");
        console.error(e);
      }
    }
  };

  if (!usage) {
    return (
      <AppShell title="Scanner">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Chargement…
        </div>
      </AppShell>
    );
  }

  if (usage.plan === "free" && usage.usage.scans >= usage.limits.scans) {
    return <LimitReached />;
  }

  const remaining = usage.limits.scans - usage.usage.scans;

  return (
    <AppShell
      title="Scanner un exercice"
      subtitle={
        usage.plan === "free"
          ? `${remaining} scan${remaining > 1 ? "s" : ""} gratuit${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} ce mois`
          : "Scans illimités — merci d'être Student 🎓"
      }
    >
      {/* ---------- Étape upload ---------- */}
      {step === "upload" && (
        <div className="mx-auto max-w-2xl">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            className={cn(
              "glass-panel rounded-3xl border-2 border-dashed p-8 text-center transition-colors sm:p-12",
              files.length === 0 ? "border-primary/30" : "border-white/60",
            )}
          >
            {files.length === 0 ? (
              <>
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImagePlus className="size-8" />
                </div>
                <h2 className="mt-5 text-xl font-bold">
                  Photo de ton exercice ou de ton cours
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  Cadre bien l'énoncé, la consigne et les données. Jusqu'à{" "}
                  {MAX_FILES} photos, {MAX_SIZE_MB} Mo max par image.
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
                >
                  <Camera className="size-4" />
                  Prendre ou importer une photo
                </button>
                <p className="mt-4 text-xs text-muted-foreground">
                  JPG, PNG, WEBP ou HEIC · photos supprimées automatiquement après
                  30 jours
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">
                    {files.length} photo{files.length > 1 ? "s" : ""} prête
                    {files.length > 1 ? "s" : ""}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setFiles([]);
                    }}
                    className="text-xs font-semibold text-muted-foreground hover:text-destructive"
                  >
                    Tout effacer
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {files.map((f, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-2xl">
                      <img
                        src={f.preview}
                        alt={`Photo ${i + 1}`}
                        className="aspect-[3/4] w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFiles((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  ))}
                  {files.length < MAX_FILES && (
                    <button
                      type="button"
                      onClick={() => inputRef.current?.click()}
                      className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <ImagePlus className="size-5" />
                      <span className="text-[11px] font-semibold">Ajouter</span>
                    </button>
                  )}
                </div>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-gradient px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110 sm:w-auto"
                  >
                    <ScanLine className="size-4" />
                    Analyser mon exercice
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                    Recommencer
                  </button>
                </div>
              </>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {error && (
            <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Sparkles, text: "Matière, niveau, consigne détectés automatiquement" },
              { icon: Zap, text: "Analyse en 2 à 4 secondes perçues" },
              { icon: CheckCircle2, text: "3 modes au choix après l'analyse" },
            ].map((b) => (
              <div
                key={b.text}
                className="glass-card flex items-start gap-2.5 rounded-2xl p-4 text-xs leading-5 text-muted-foreground"
              >
                <b.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                {b.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Étape analyse ---------- */}
      {step === "analyzing" && (
        <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
          <div className="relative">
            <div className="flex size-28 items-center justify-center rounded-full bg-primary/10">
              <ScanLine className="size-12 animate-pulse text-primary" />
            </div>
            <div className="absolute -inset-3 animate-spin rounded-full border-2 border-transparent border-t-primary/60" style={{ animationDuration: "1.4s" }} />
          </div>
          <motion.h2
            key={analysisStep}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-xl font-bold"
          >
            Analyse de ton exercice…
          </motion.h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ANALYSIS_STEPS[analysisStep]}
          </p>
          <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-zinc-200/70">
            <motion.div
              className="h-full rounded-full bg-brand-gradient"
              initial={{ width: "8%" }}
              animate={{ width: "92%" }}
              transition={{ duration: 3.8, ease: "easeInOut" }}
            />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-2 text-left text-xs text-muted-foreground">
            {ANALYSIS_STEPS.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1",
                  i < analysisStep
                    ? "bg-emerald-50 text-emerald-700"
                    : i === analysisStep
                      ? "bg-primary/5 text-primary"
                      : "",
                )}
              >
                {i < analysisStep ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                <span className="truncate">{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------- Étape choix du mode ---------- */}
      {step === "mode" && (
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="size-3.5" />
              Analyse terminée — ton exercice a bien été lu
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
              Comment veux-tu la réponse ?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu peux changer de mode à tout moment depuis le résultat.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {MODES.map((m, i) => (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => handlePickMode(m.id)}
                className="glass-card group relative flex flex-col rounded-3xl p-6 text-left transition-all hover:-translate-y-1 hover:shadow-xl"
              >
                <span className="absolute right-4 top-4 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {m.tag}
                </span>
                <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                  {m.emoji}
                </div>
                <h3 className="mt-4 font-bold">{m.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {m.text}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
                  Voir le résultat
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </motion.button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="mx-auto mt-8 flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className="size-4" />
            Analyser une autre photo
          </button>
        </div>
      )}

    </AppShell>
  );
}
