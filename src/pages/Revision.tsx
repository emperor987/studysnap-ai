import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  BookOpen,
  CheckSquare,
  CircleDot,
  FileQuestion,
  Loader2,
  PenLine,
  Play,
  Plus,
  Target,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getAiErrorMessage } from "@/lib/ai-errors";
import { formatDateFr, levelLabel, subjectEmoji } from "@/lib/format";
import type { ConvexError } from "convex/values";

// Libellés courts : sur mobile, les boutons de difficulté (3 colonnes)
// débordaient avec « Intermédiaire » — on garde l'action essentielle.
const DIFFICULTIES = [
  { id: "easy", label: "Facile", emoji: "🌱" },
  { id: "medium", label: "Mid", emoji: "🔥" },
  { id: "hard", label: "Difficile", emoji: "💀" },
];

const TYPES = [
  { id: "qcm" as const, label: "QCM", icon: CircleDot },
  { id: "truefalse" as const, label: "Vrai / Faux", icon: CheckSquare },
  { id: "free" as const, label: "Réponse libre", icon: PenLine },
  { id: "problem" as const, label: "Problème", icon: FileQuestion },
];

export default function Revision() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quizzes = useQuery(api.quizzes.listMyQuizzes);
  const subjects = useQuery(api.subjects.listSubjects);

  const [subject, setSubject] = useState(searchParams.get("subject") ?? "");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState(10);
  const [types, setTypes] = useState<string[]>(["qcm", "truefalse", "free", "problem"]);
  const [creating, setCreating] = useState(false);
  const [genStep, setGenStep] = useState(0);

  const generateQuiz = useAction(api.ai.generateQuiz);
  const saveQuiz = useMutation(api.quizzes.saveQuiz);

  const toggleType = (id: string) => {
    setTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  // Étapes affichées pendant la génération : la génération IA peut prendre
  // 1 à 2 minutes (file d'attente du fournisseur), un état visuel clair évite
  // de laisser l'utilisateur croire que la page est bloquée.
  const QUIZ_STEPS = [
    "Préparation des questions…",
    "Génération par l'IA…",
    "Finalisation du quiz…",
  ];

  useEffect(() => {
    if (!creating) return;
    setGenStep(0);
    const t = setInterval(
      () => setGenStep((s) => Math.min(s + 1, QUIZ_STEPS.length - 1)),
      1400,
    );
    return () => clearInterval(t);
  }, [creating]);

  const handleCreate = async () => {
    if (types.length === 0) {
      toast.error("Choisis au moins un type de question.");
      return;
    }
    setCreating(true);
    try {
      const generated = await generateQuiz({
        subject: subject || "Mathématiques",
        level: "seconde",
        count,
        difficulty,
        types: types as ("qcm" | "truefalse" | "free" | "problem")[],
        topic: searchParams.get("topic") ?? undefined,
      });
      const id = await saveQuiz({
        subject: subject || "Mathématiques",
        level: "seconde",
        title: generated.title,
        settings: { count, difficulty, types: types as never },
        questions: generated.questions as never,
      });
      navigate(`/revision/quiz/${id}`);
    } catch (e) {
      const aiMsg = getAiErrorMessage(e);
      if (aiMsg) {
        toast.error(aiMsg);
      } else {
        const code = (e as ConvexError<{ code?: string }>)?.data?.code;
        if (code === "LIMIT_REACHED") {
          toast.error("Limite de 3 quiz gratuits atteinte — passe à Student pour en créer plus.");
        } else if (code === "PARENTAL_PENDING") {
          toast.error(
            "Ton compte est en attente de validation par un parent — accès limité jusqu'à sa confirmation.",
          );
        } else {
          console.error(e);
          toast.error("La génération du quiz a échoué. Réessaie.");
        }
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <AppShell
      title="Révision"
      subtitle="Quiz sur mesure : une question à la fois, feedback immédiat, score final."
    >
      {/* Créateur de quiz */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Target className="size-5 sm:size-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold sm:text-lg">Nouveau quiz</h2>
            <p className="text-xs text-muted-foreground">
              Difficulté et type de questions paramétrables
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Matière
            </label>
            <Select value={subject || undefined} onValueChange={setSubject}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Choisir une matière" />
              </SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Nombre de questions : {count}
            </label>
            <input
              type="range"
              min={5}
              max={20}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[#4f4fe5]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>5</span>
              <span>20</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Difficulté
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDifficulty(d.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
                  difficulty === d.id
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-white/6 text-muted-foreground",
                )}
              >
                <span>{d.emoji}</span>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
            Types de questions
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleType(t.id)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold transition-colors",
                  types.includes(t.id)
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-white/6 text-muted-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          onClick={handleCreate}
          disabled={creating}
          className="mt-6 h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110 sm:w-auto sm:px-8"
        >
          {creating ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Génération…
            </>
          ) : (
            <>
              <Play className="mr-2 size-4" />
              Générer
            </>
          )}
        </Button>

        {creating && (
          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Loader2 className="size-4 animate-spin" />
                {QUIZ_STEPS[genStep]}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                1 à 2 min max
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-gradient" />
            </div>
          </div>
        )}
        {searchParams.get("topic") && (
          <p className="mt-3 text-xs text-muted-foreground">
            Notion ciblée : <span className="font-semibold">{searchParams.get("topic")}</span>
          </p>
        )}
      </section>

      {/* Historique des quiz */}
      <section className="mt-8">
        <h2 className="text-lg font-bold sm:text-xl">Quiz passés</h2>
        {quizzes && quizzes.length === 0 ? (
          <div className="glass-card mt-4 rounded-3xl p-8 text-center">
            <BookOpen className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Aucun quiz pour l'instant. Lance ton premier quiz pour voir ta
              progression !
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(quizzes ?? []).map((q) =>
              q.status === "done" ? (
                <Link
                  key={q._id}
                  to={`/revision/quiz/${q._id}`}
                  className="glass-card rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {subjectEmoji(q.subject)} {q.subject}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                      q.status === "done"
                        ? (q.score ?? 0) >= (q.total ?? 1) * 0.7
                          ? "bg-mint-500/15 text-mint-300"
                          : "bg-amber-500/15 text-amber-300"
                        : "bg-white/10 text-muted-foreground",
                    )}
                  >
                    {q.status === "done"
                      ? `${q.score}/${q.total}`
                      : "En cours"}
                  </span>
                </div>
                <p className="mt-3 text-sm font-bold leading-5 sm:text-[15px]">{q.title}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {levelLabel(q.level)} · {q.settings.count} questions ·{" "}
                    {formatDateFr(q.createdAt)}
                  </p>
                </Link>
              ) : (
                <div
                  key={q._id}
                  className="glass-card rounded-2xl p-5 opacity-70"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {subjectEmoji(q.subject)} {q.subject}
                    </span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                      En cours
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-5 sm:text-[15px]">{q.title}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {levelLabel(q.level)} · {q.settings.count} questions ·{" "}
                    {formatDateFr(q.createdAt)}
                  </p>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <div className="mt-6">
        <Link
          to="/sheets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <Plus className="size-4" />
          Créer une fiche de révision
        </Link>
      </div>
    </AppShell>
  );
}
