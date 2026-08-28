import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  Sparkles,
  Trash2,
  UserRoundPlus,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
// Note: motion is unused after removing mode selection — kept for future use.
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getAiErrorMessage } from "@/lib/ai-errors";
import {
  documentKind,
  FICHE_ANALYSIS_WARNING,
  LONG_ANALYSIS_WARNING,
  type DocumentKind,
} from "@/lib/analysis";
import { useDevice } from "@/hooks/use-device";
import { downscaleImage } from "@/lib/image";
import type { ConvexError } from "convex/values";

type Step = "upload" | "analyzing" | "gated";

type GatedInfo = {
  category: string;
  reason: string;
  subjectLabel?: string;
  levelLabel?: string;
};

const MAX_FILES = 6;
const MAX_SIZE_MB = 10;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const ANALYSIS_STEPS = [
  "Lecture de la photo…",
  "Analyse de l'exercice…",
  "Préparation de ta réponse…",
];



function GuestLimitReached() {
  return (
    <AppShell title="Mode démo terminé" subtitle="Scanner">
      <div className="glass-panel mx-auto max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-lg shadow-indigo-500/25">
          ✨
        </div>
        <span className="glass-chip mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
          <UserRoundPlus className="size-3.5" />
          Mode démo
        </span>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
          Crée ton compte pour continuer à scanner gratuitement
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Ton scan de démo est utilisé — tu as vu l'essentiel : analyse IA en
          quelques secondes, réponse directe et explication détaillée. Avec un
          compte (10 secondes, juste ton email), tu peux scanner gratuitement
          chaque mois, créer des fiches de révision, faire des quiz et suivre
          ta progression.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/auth?mode=signup&returnTo=/scanner"
            className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            <UserRoundPlus className="size-4" />
            Créer mon compte gratuitement
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
          >
            Retour à l'accueil
          </Link>
        </div>
        <p className="mt-5 text-xs text-muted-foreground">
          Aucune donnée d'invité n'est conservée — ton compte, lui, garde tes
          exercices.
        </p>
      </div>
    </AppShell>
  );
}

function LimitReached() {
  return (
    <AppShell title="Limite gratuite atteinte" subtitle="Scanner">
      <div className="glass-panel mx-auto max-w-lg rounded-3xl p-8 text-center sm:p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-lg shadow-indigo-500/25">
          🔥
        </div>
        <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
          Tes 4 scans gratuits de ce mois sont utilisés
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
            className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
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
  const { isMobile } = useDevice();
  const [step, setStep] = useState<Step>("upload");
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [phase, setPhase] = useState<"ocr" | "generate">("ocr");
  const [analysis, setAnalysis] = useState<unknown>(null);
  const [fullText, setFullText] = useState("");
  const [storageIds, setStorageIds] = useState<string[]>([]);
  const [storageTypes, setStorageTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [extraText, setExtraText] = useState("");
  const [willBeLong, setWillBeLong] = useState(false);
  const [docKind, setDocKind] = useState<DocumentKind>("exercise");
  const [gated, setGated] = useState<GatedInfo | null>(null);

  const usage = useQuery(api.usage.getMyUsage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const registerUpload = useMutation(api.files.registerUpload);
  const scanAndAnalyze = useAction(api.ai.scanAndAnalyze);
  const recordScan = useMutation(api.scans.recordScan);
  const inputRef = useRef<HTMLInputElement>(null);

  // Pendant l'analyse, les étapes défilent automatiquement.
  useEffect(() => {
    if (step !== "analyzing") return;
    setAnalysisStep(0);
    const interval = setInterval(
      () => setAnalysisStep((s) => Math.min(s + 1, ANALYSIS_STEPS.length - 1)),
      1200,
    );
    return () => clearInterval(interval);
  }, [step]);

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
    setWillBeLong(false);
    setDocKind("exercise");
    setGated(null);
    setPhase("ocr");
    setStep("analyzing");
    try {
      // Compression côté client : des photos plus petites = analyse IA
      // beaucoup plus rapide (tokens image réduits). Préparation + upload en
      // PARALLÈLE : les photos sont indépendantes, les traiter une par une
      // allongeait l'attente à chaque image (l'ordre est préservé par
      // Promise.all).
      const prepared = await Promise.all(
        files.map((f) => downscaleImage(f.file)),
      );
      const preparedTypes = prepared.map((p) => p.type);
      const storageIds = await Promise.all(
        prepared.map(async (p) => {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": p.type },
            body: p,
          });
          if (!res.ok) throw new Error("Upload impossible");
          const { storageId } = (await res.json()) as { storageId: string };
          // Enregistre le fichier comme appartenant à l'utilisateur : sans
          // cet enregistrement, les mutations/actions refusent de l'utiliser.
          await registerUpload({ storageId, contentType: p.type });
          return storageId;
        }),
      );

      // ---- Appel combiné OCR + Analyse en UN SEUL appel serveur ----
      // Élimine le aller-retour client→Convex→client entre les deux étapes.
      const combinedResult = await scanAndAnalyze({
        storageIds,
        contentTypes: preparedTypes,
        prompt: extraText.trim() || undefined,
      });

      // Photo illisible
      if ("unreadable" in combinedResult) {
        setError(combinedResult.note ?? "Photo illisible");
        setStep("upload");
        return;
      }

      // Contenu avancé (paywall)
      if ("gated" in combinedResult) {
        setGated({
          category: combinedResult.category,
          reason: combinedResult.reason,
          subjectLabel: combinedResult.subjectLabel,
          levelLabel: combinedResult.levelLabel,
        });
        setStep("gated");
        return;
      }

      // Résultat normal
      const result = combinedResult;
      // Détection du type de document pour l'UI
      const kind = documentKind(`${extraText.trim() || "exercice"}`);
      setDocKind(kind);
      setWillBeLong(kind !== "exercise");
      setAnalysis(result);
      setFullText(extraText.trim() || "exercice");
      setStorageIds(storageIds);
      setStorageTypes(preparedTypes);
      // Auto-save et redirect
      try {
        const scanId = await recordScan({
          storageIds,
          contentTypes: preparedTypes,
          analysis: result as never,
          mode: "explain",
          fullText: extraText.trim() || undefined,
        });
        navigate(`/scanner/result/${scanId}`);
      } catch (saveErr) {
        const code = (saveErr as ConvexError<{ code?: string }>)?.data?.code;
        if (code === "GUEST_LIMIT_REACHED") {
          toast.error("Crée ton compte pour continuer à scanner gratuitement.");
        } else if (code === "LIMIT_REACHED") {
          toast.error("Limite gratuite atteinte — passe à Student pour continuer.");
        } else if (code === "RATE_LIMITED") {
          toast.error("Un petit instant entre deux scans…");
        } else if (code === "PARENTAL_PENDING") {
          toast.error(
            "Ton compte est en attente de validation par un parent — accès limité jusqu'à sa confirmation.",
          );
        } else {
          toast.error("Impossible d'enregistrer le scan.");
          console.error(saveErr);
        }
        setStep("upload");
      }
    } catch (e) {
      console.error(e);
      const aiMsg = getAiErrorMessage(e);
      if (aiMsg) {
        toast.error(aiMsg);
      } else {
        const code = (e as ConvexError<{ code?: string }>)?.data?.code;
        if (code === "GUEST_LIMIT_REACHED") {
          // Invité : le scan de démo est déjà utilisé → l'écran de création
          // de compte s'affiche dès que le compteur remonte (réactif).
          toast.error("Crée ton compte pour continuer à scanner gratuitement.");
        } else if (code === "LIMIT_REACHED") {
          toast.error("Limite gratuite atteinte — passe à Student pour continuer.");
        } else if (code === "RATE_LIMITED") {
          toast.error("Un petit instant entre deux analyses…");
        } else if (code === "PARENTAL_PENDING") {
          toast.error(
            "Ton compte est en attente de validation par un parent — accès limité jusqu'à sa confirmation.",
          );
        } else {
          toast.error("L'analyse a échoué. Réessaie avec une photo plus nette.");
        }
      }
      setStep("upload");
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
    // Invité : le scan de démo est consommé → invitation à créer un compte.
    // Compte gratuit classique : la limite mensuelle est atteinte → pricing.
    return usage.isGuest ? <GuestLimitReached /> : <LimitReached />;
  }

  const remaining = usage.limits.scans - usage.usage.scans;

  return (
    <AppShell
      title="Scanner un exercice"
      subtitle={
        usage.isGuest
          ? "Mode démo — 1 scan gratuit, rien n'est conservé après ta visite"
          : usage.plan === "free"
            ? `${remaining} scan${remaining > 1 ? "s" : ""} gratuit${remaining > 1 ? "s" : ""} restant${remaining > 1 ? "s" : ""} ce mois`
            : "Scans illimités — merci d'être Student 🎓"
      }
    >
      {/* Bandeau invité : cadre clair du mode démo avant l'import */}
      {usage.isGuest && step === "upload" && (
        <div className="mx-auto mb-5 flex max-w-2xl items-start gap-3 rounded-2xl border border-primary/25 bg-primary/8 p-4">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserRoundPlus className="size-4" />
          </span>
          <div className="text-sm leading-6">
            <p className="font-bold">
              🧪 Mode démo — {remaining} scan de démo
            </p>
            <p className="text-xs text-muted-foreground">
              Après ce scan, crée ton compte pour continuer à scanner
              gratuitement. Les fiches, quiz, historique et progression sont
              réservés aux comptes.
            </p>
          </div>
        </div>
      )}
      {/* ---------- Étape upload ---------- */}
      {step === "upload" && (
        <div
          className="mx-auto max-w-2xl"
          onDragOver={(e) => {
            if (isMobile) return;
            e.preventDefault();
          }}
          onDrop={(e) => {
            if (isMobile) return;
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
        >
          {files.length === 0 ? (
            /* Sélecteur de fichiers UNIQUE (galerie mobile / drag & drop
               desktop) : la prise de photo directe a été retirée, il n'y a
               plus de choix à faire avant l'import. */
            <div className="glass-panel w-full max-w-full rounded-3xl border-2 border-dashed border-primary/30 p-6 sm:p-10">
              <div className="text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImagePlus className="size-8" />
                </div>
                <h2 className="mt-5 text-xl font-bold">
                  Photo de ton exercice ou de ton cours
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                  {isMobile
                    ? "Choisis une photo depuis ta galerie. Cadre bien l'énoncé, la consigne et les données."
                    : "Dépose ta photo ici ou choisis un fichier. Cadre bien l'énoncé, la consigne et les données."}{" "}
                  Jusqu'à {MAX_FILES} photos, {MAX_SIZE_MB} Mo max par image.
                </p>
              </div>

              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
                >
                  <ImagePlus className="size-4" />
                  {isMobile ? "Importer depuis la galerie" : "Choisir un fichier"}
                </button>
              </div>

              {!isMobile && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  …ou glisse-dépose une ou plusieurs photos ici
                </p>
              )}

              <p className="mt-5 text-center text-xs text-muted-foreground">
                JPG, PNG, WEBP ou HEIC · photos supprimées automatiquement
                après 30 jours
              </p>
            </div>
          ) : (
            /* ---------- Aperçu des photos (commun mobile / PC) ---------- */
            <div className="glass-panel rounded-3xl border-2 border-dashed border-white/10 p-6 sm:p-8">
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
            </div>
          )}

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

          {/* Texte de l'énoncé en option : accélère et fiabilise l'analyse. */}
          <details className="group mt-6 rounded-2xl border border-border/60 bg-white/5 p-4 open:bg-white/8">
            <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-semibold text-primary">
              <FileText className="size-4" />
              Ajouter le texte de l'énoncé (optionnel)
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Si tu as l'énoncé en texte (ou si la photo est moyenne), colle-le
              ici : l'analyse sera plus rapide, plus fiable et les énoncés
              longs prendront moins de temps.
            </p>
            <textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              rows={4}
              placeholder="Ex. : Résoudre dans R l'équation 2x² − 5x + 3 = 0, puis étudier le signe de f(x) sur R…"
              className="mt-3 w-full resize-y rounded-xl border border-border bg-white/5 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            />
            {extraText.trim().length > 700 && (
              <p className="mt-2 text-xs font-semibold text-amber-300">
                ⏳ Énoncé long détecté : l'analyse peut prendre 1 à 2 minutes.
              </p>
            )}
          </details>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Sparkles, text: "Matière, niveau, consigne détectés automatiquement" },
              { icon: Zap, text: "Analyse rapide en quelques secondes" },
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
            key={`${phase}-${analysisStep}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 text-xl font-bold"
          >
            {phase === "ocr"
              ? "Analyse en cours…"
              : "Analyse en cours…"}
          </motion.h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ANALYSIS_STEPS[analysisStep] ?? ANALYSIS_STEPS[ANALYSIS_STEPS.length - 1]}
          </p>
          <div className="mt-6 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
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
                    ? "bg-mint-500/10 text-mint-300"
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
                <span className="break-words">{s}</span>
              </div>
            ))}
          </div>

          {phase === "generate" && willBeLong && (
            <div className="mt-6 max-w-sm rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-left text-xs leading-5 text-amber-200">
              <p className="font-bold">
                ⏳ {docKind === "fiche"
                  ? "Fiche ou cours complet détecté"
                  : "L'analyse peut prendre 1 à 2 minutes"}
              </p>
              <p className="mt-1">
                {docKind === "fiche"
                  ? FICHE_ANALYSIS_WARNING
                  : LONG_ANALYSIS_WARNING}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---------- Étape contenu avancé détecté (paywall) ---------- */}
      {step === "gated" && gated && (
        <div className="mx-auto max-w-xl">
          <div className="glass-panel rounded-3xl p-8 text-center sm:p-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-gradient text-2xl text-white shadow-lg shadow-indigo-500/25">
              🎓
            </div>
            <span className="glass-chip mx-auto mt-5 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-amber-300">
              {gated.levelLabel ?? "Niveau avancé détecté"}
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight">
              Analyse approfondie réservée aux plans Student
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {gated.reason}
            </p>
            {gated.subjectLabel && (
              <p className="mt-2 text-xs font-semibold text-muted-foreground">
                Matière détectée : {gated.subjectLabel}
              </p>
            )}
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <Zap className="size-4" />
                Découvrir Student & Student Pro
              </Link>
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
              >
                <RefreshCw className="size-4" />
                Scanner autre chose
              </button>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              Les exercices classiques (maths, français, histoire-géo, SVT…) restent
              gratuits — seul ce type de contenu avancé nécessite un plan payant.
            </p>
          </div>
        </div>
      )}



    </AppShell>
  );
}
