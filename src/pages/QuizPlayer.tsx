import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Link, useParams } from "react-router";
import { cn } from "@/lib/utils";
import { levelLabel, subjectEmoji } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

type Answer = { questionIndex: number; selected?: string; isCorrect: boolean };

export default function QuizPlayer() {
  const { quizId } = useParams<{ quizId: string }>();
  const quiz = useQuery(api.quizzes.getQuiz, {
    quizId: quizId as Id<"quizzes">,
  });
  const saveResult = useMutation(api.quizzes.saveQuizResult);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [finished, setFinished] = useState(false);
  const [saving, setSaving] = useState(false);
  const startRef = useRef(Date.now());

  const question = quiz?.questions[index];

  /* Notions faibles. Calculé ICI (avant tout retour anticipé) : un useMemo
   * placé après le `if (!quiz) return` serait un hook conditionnel — quand le
   * quiz arrive, React lèverait « Rendered more hooks than during the
   * previous render » et l'écran de résultat ne s'afficherait jamais. */
  const weakTopics = useMemo(() => {
    if (answers.length === 0) return [];
    const byTopic = new Map<string, { c: number; t: number }>();
    for (const a of answers) {
      const q = quiz?.questions[a.questionIndex];
      const t = q?.topic ?? "Général";
      const e = byTopic.get(t) ?? { c: 0, t: 0 };
      e.t += 1;
      if (a.isCorrect) e.c += 1;
      byTopic.set(t, e);
    }
    return [...byTopic.entries()]
      .filter(([, e]) => e.t >= 1 && e.c / e.t < 0.6)
      .map(([t]) => t);
  }, [answers, quiz]);

  const isLast = useMemo(
    () => Boolean(quiz) && index === (quiz?.questions.length ?? 1) - 1,
    [quiz, index],
  );

  useEffect(() => {
    if (quiz?.status === "done" && !finished && !answered) {
      setFinished(true);
    }
  }, [quiz, finished, answered]);

  const checkAnswer = (value: string) => {
    if (!question || answered) return;
    const correct = value.trim().toLowerCase() === question.answer.trim().toLowerCase();
    setSelected(value);
    setAnswered(true);
    setAnswers((prev) => [
      ...prev,
      { questionIndex: index, selected: value, isCorrect: correct },
    ]);
  };

  const next = () => {
    if (isLast) {
      finish();
    } else {
      setIndex((i) => i + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const finish = async () => {
    if (!quiz) return;
    setSaving(true);
    const durationSeconds = Math.round((Date.now() - startRef.current) / 1000);
    try {
      await saveResult({
        quizId: quiz._id,
        answers,
        durationSeconds,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setFinished(true);
    }
  };

  const retry = () => {
    setIndex(0);
    setSelected(null);
    setAnswered(false);
    setAnswers([]);
    setFinished(false);
    startRef.current = Date.now();
  };

  if (!quiz) {
    return (
      <AppShell title="Quiz">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Chargement du quiz…
        </div>
      </AppShell>
    );
  }

  /* ---------- Écran de score ---------- */
  if (finished && quiz.status === "done" && quiz.score !== undefined) {
    const score = quiz.score;
    const total = quiz.total ?? quiz.questions.length;
    const pct = Math.round((score / total) * 100);

    return (
      <AppShell title="Résultat du quiz" subtitle={quiz.title}>
        <div className="mx-auto max-w-lg text-center">
          <div className="glass-panel rounded-3xl p-8">
            <div
              className={cn(
                "mx-auto flex size-24 items-center justify-center rounded-full text-3xl font-black",
                pct >= 70
                  ? "bg-mint-500/15 text-mint-300"
                  : pct >= 40
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-rose-500/15 text-rose-400",
              )}
            >
              {pct}%
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight">
              {pct >= 70
                ? "Bien joué ! 🎉"
                : pct >= 40
                  ? "Pas mal, continue !"
                  : "C'est en révisant qu'on progresse"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {score} bonne{score > 1 ? "s" : ""} réponse{score > 1 ? "s" : ""} sur{" "}
              {total} question{total > 1 ? "s" : ""}
            </p>

            {weakTopics.length > 0 && (
              <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
                <p className="flex items-center gap-1.5 text-sm font-bold text-amber-300">
                  <Target className="size-4" />
                  Notions à revoir
                </p>
                <ul className="mt-2 space-y-1.5">
                  {weakTopics.map((t) => (
                    <li key={t} className="text-sm text-amber-300">
                      • {t}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-amber-300/80">
                  Reprends la fiche de révision correspondante puis refais le
                  quiz.
                </p>
              </div>
            )}

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <RotateCcw className="size-4" />
                Recommencer le quiz
              </button>
              <Link
                to="/revision"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/8 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white/15"
              >
                <Sparkles className="size-4" />
                Nouveau quiz
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  if (finished) {
    return (
      <AppShell title="Quiz">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {saving ? "Enregistrement du score…" : "Chargement…"}
        </div>
      </AppShell>
    );
  }

  if (!question) {
    return (
      <AppShell title="Quiz">
        <p className="text-muted-foreground">Aucune question.</p>
      </AppShell>
    );
  }

  const q = question;
  const isCorrectSelected =
    answered && selected?.trim().toLowerCase() === q.answer.trim().toLowerCase();

  return (
    <AppShell
      title={quiz.title}
      subtitle={`${subjectEmoji(quiz.subject)} ${quiz.subject} · ${levelLabel(quiz.level)} · Question ${index + 1}/${quiz.questions.length}`}
    >
      <div className="mx-auto max-w-2xl">
        {/* Progression */}
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-brand-gradient transition-all"
              style={{ width: `${((index + (answered ? 1 : 0)) / quiz.questions.length) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {index + 1}/{quiz.questions.length}
          </span>
        </div>

        <div className="glass-panel mt-6 rounded-3xl p-6 sm:p-8">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
            {q.type === "qcm"
              ? "QCM"
              : q.type === "truefalse"
                ? "Vrai / Faux"
                : q.type === "free"
                  ? "Réponse libre"
                  : "Problème"}
          </span>
          <h2 className="mt-4 text-lg font-bold leading-7 sm:text-xl">{q.question}</h2>

          <div className="mt-6 space-y-2.5">
            {q.options ? (
              q.options.map((opt, i) => {
                const isAnswer = opt.trim().toLowerCase() === q.answer.trim().toLowerCase();
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={answered}
                    onClick={() => checkAnswer(opt)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition-all",
                      !answered && "border-border bg-white/6 hover:border-primary/40 hover:bg-white/15",
                      answered && isAnswer && "border-mint-500/40 bg-mint-500/10 text-mint-200",
                      answered && !isAnswer && selected === opt && "border-rose-500/40 bg-rose-500/10 text-rose-300",
                      answered && !isAnswer && selected !== opt && "border-border/70 bg-white/4 text-muted-foreground",
                    )}
                  >
                    <span>
                      <span className="mr-2 font-bold">{String.fromCharCode(65 + i)}.</span>
                      {opt}
                    </span>
                    {answered && isAnswer && (
                      <Check className="size-4 text-mint-500" />
                    )}
                    {answered && !isAnswer && selected === opt && (
                      <X className="size-4 text-rose-400" />
                    )}
                  </button>
                );
              })
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = new FormData(e.currentTarget).get("answer") as string;
                  if (!input.trim()) return;
                  checkAnswer(input);
                }}
              >
                <input
                  name="answer"
                  placeholder="Écris ta réponse ici…"
                  disabled={answered}
                  className="h-12 w-full rounded-xl border border-border bg-white/8 px-4 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
                {!answered && (
                  <button
                    type="submit"
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-all hover:brightness-110"
                  >
                    Valider
                  </button>
                )}
              </form>
            )}
          </div>

          {/* Feedback + explication */}
          {answered && (
            <div
              className={cn(
                "mt-5 rounded-2xl border p-4",
                isCorrectSelected
                  ? "border-mint-500/30 bg-mint-500/10"
                  : "border-rose-500/30 bg-rose-500/10",
              )}
            >
              <p
                className={cn(
                  "flex items-center gap-2 text-sm font-bold",
                  isCorrectSelected ? "text-mint-300" : "text-rose-300",
                )}
              >
                {isCorrectSelected ? (
                  <>
                    <CheckCircle2 className="size-4" />
                    Bonne réponse !
                  </>
                ) : (
                  <>
                    <X className="size-4" />
                    Pas tout à fait
                  </>
                )}
              </p>
              {!isCorrectSelected && (
                <p className="mt-1 text-sm">
                  Réponse attendue :{" "}
                  <span className="font-bold text-mint-300">{q.answer}</span>
                </p>
              )}
              {q.explanation && (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  💡 {q.explanation}
                </p>
              )}
            </div>
          )}
        </div>

        {answered && (
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
            >
              {isLast ? "Voir mon score" : "Question suivante"}
              <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

