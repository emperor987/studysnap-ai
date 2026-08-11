import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpen,
  Camera,
  FileText,
  Flame,
  Play,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import {
  formatDateTimeFr,
  levelLabel,
  modeLabel,
  pluralFr,
  subjectEmoji,
} from "@/lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scans = useQuery(api.scans.listMyScans);
  const sheets = useQuery(api.revisionSheets.listMySheets);
  const quizzes = useQuery(api.quizzes.listMyQuizzes);
  const usage = useQuery(api.usage.getMyUsage);
  const stats = useQuery(api.usage.getMyStats);
  const createDemoScan = useMutation(api.scans.createDemoScan);
  const createDemoSheet = useMutation(api.revisionSheets.createDemoSheet);

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "Élève";
  const loading =
    scans === undefined || sheets === undefined || quizzes === undefined;

  const empty = !loading && scans.length === 0 && sheets.length === 0;

  const handleDemo = async () => {
    try {
      const scanId = await createDemoScan({});
      toast.success("Exercice d'exemple créé — découvre-le !");
      navigate(`/scanner/result/${scanId}`);
    } catch (e) {
      toast.error("Impossible de créer l'exemple.");
      console.error(e);
    }
  };

  const handleDemoSheet = async () => {
    try {
      const id = await createDemoSheet({});
      toast.success("Fiche d'exemple créée !");
      navigate(`/sheets/${id}`);
    } catch (e) {
      toast.error("Impossible de créer l'exemple.");
      console.error(e);
    }
  };

  const recentScans = (scans ?? []).slice(0, 3);
  const lastQuiz = (quizzes ?? []).find((q) => q.status === "done");

  const statsCards = [
    {
      icon: Flame,
      label: "Scans ce mois",
      value: usage ? `${usage.usage.scans}/${usage.plan === "free" ? 5 : "∞"}` : "—",
      hint: usage?.plan === "free" ? "plan gratuit" : "plan illimité",
      color: "text-coral-500 bg-coral-500/10",
    },
    {
      icon: FileText,
      label: "Fiches",
      value: String(sheets?.length ?? "—"),
      hint: "fiches de révision",
      color: "text-primary bg-primary/10",
    },
    {
      icon: Trophy,
      label: "Taux de réussite",
      value: stats ? `${stats.globalRate}%` : "—",
      hint: stats ? `${stats.totalQuestions} questions répondues` : "fais un quiz !",
      color: "text-mint-600 bg-mint-500/10",
    },
  ];

  return (
    <AppShell
      title={`Salut, ${firstName} 👋`}
      subtitle={
        empty
          ? "Ton espace est prêt — scanne ton premier exercice."
          : "Prêt·e à progresser aujourd'hui ?"
      }
    >
      {/* CTA principal */}
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-coral-500/10 blur-3xl" />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              Photo → Analyse IA → Ta méthode
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Un exercice bloquant ?{" "}
              <span className="text-brand-gradient">Scanne-le.</span>
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Réponse rapide, explication pas à pas ou fiche de révision — l'IA
              s'adapte à ton niveau, en 2 à 4 secondes.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/scanner"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <Camera className="size-4" />
                Scanner un exercice
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                to="/sheets"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-white/70 px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-white"
              >
                <BookOpen className="size-4" />
                Nouvelle fiche de révision
              </Link>
            </div>
          </div>
          <div className="hidden shrink-0 rounded-3xl border border-white/60 bg-white/40 p-5 sm:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Démo de scan
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="size-2 rounded-full bg-primary" />
                Photo de l'exercice
              </div>
              <div className="ml-3 h-1.5 w-36 rounded-full bg-primary/20" />
              <div className="ml-3 h-1.5 w-28 rounded-full bg-primary/20" />
              <p className="text-xs text-mint-600">✓ Analyse terminée (2,4 s)</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {statsCards.map((s) => (
          <div key={s.label} className="glass-card rounded-2xl p-5">
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${s.color}`}
            >
              <s.icon className="size-5" />
            </div>
            <p className="mt-3 text-2xl font-extrabold tracking-tight">{s.value}</p>
            <p className="text-sm font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </section>

      {/* Vide : démo à vide */}
      {empty && (
        <section className="mt-8">
          <div className="glass-card rounded-3xl p-8 text-center sm:p-10">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Zap className="size-8" />
            </div>
            <h3 className="mt-5 text-xl font-bold">
              Vois StudySnap en action, sans rien préparer
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Ajoute un exercice d'exemple (résolu par l'IA en mode démo) ou une
              fiche de révision type, pour explorer l'interface avant de scanner
              ton vrai devoir.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDemo}
                className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <Camera className="size-4" />
                Essayer avec un exercice d'exemple
              </button>
              <button
                type="button"
                onClick={handleDemoSheet}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-6 py-3 text-sm font-semibold transition-colors hover:bg-white"
              >
                <FileText className="size-4" />
                Ajouter une fiche d'exemple
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Activité récente */}
      {!loading && !empty && (
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold sm:text-lg">Exercices récents</h3>
              <Link
                to="/exercises"
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Tout voir
              </Link>
            </div>
            {recentScans.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Aucun exercice pour l'instant.
              </p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {recentScans.map((scan) => (
                  <Link
                    key={scan._id}
                    to={`/scanner/result/${scan._id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/40 p-3 transition-colors hover:bg-white/70"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">
                      {subjectEmoji(scan.subject)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{scan.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {scan.subject} · {modeLabel(scan.mode ?? "explain")} ·{" "}
                        {formatDateTimeFr(scan.createdAt)}
                      </p>
                    </div>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-3xl p-6">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold sm:text-lg">Dernier quiz</h3>
              <Link
                to="/revision"
                className="shrink-0 text-xs font-semibold text-primary hover:underline"
              >
                Réviser
              </Link>
            </div>
            {lastQuiz ? (
              <div className="mt-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                      (lastQuiz.score ?? 0) >= (lastQuiz.total ?? 1) * 0.7
                        ? "bg-mint-100 text-mint-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {lastQuiz.score}/{lastQuiz.total}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold sm:text-base">
                      {lastQuiz.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {lastQuiz.subject} · {levelLabel(lastQuiz.level)} ·{" "}
                      {formatDateTimeFr(lastQuiz.createdAt)}
                    </p>
                  </div>
                </div>
                <Link
                  to="/revision"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white"
                >
                  <Play className="size-3.5" />
                  Nouveau quiz
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">
                  Aucun quiz terminé. Teste tes connaissances en 5 questions.
                </p>
                <Link
                  to="/revision"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white"
                >
                  <Target className="size-3.5" />
                  Créer un quiz
                </Link>
              </div>
            )}
            <div className="mt-5 border-t border-border/70 pt-4">
              <p className="text-xs text-muted-foreground">
                {sheets?.length ?? 0}{" "}
                {pluralFr(sheets?.length ?? 0, "fiche de révision")} ·{" "}
                {(scans ?? []).length}{" "}
                {pluralFr((scans ?? []).length, "exercice scanné")} ·{" "}
                {(quizzes ?? []).length} {pluralFr((quizzes ?? []).length, "quiz")}
              </p>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
