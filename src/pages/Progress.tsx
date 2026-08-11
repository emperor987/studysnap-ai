import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Clock,
  Flame,
  Loader2,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { subjectEmoji } from "@/lib/format";

export default function Progress() {
  const stats = useQuery(api.usage.getMyStats);

  if (!stats) {
    return (
      <AppShell title="Progression">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Chargement de ta progression…
        </div>
      </AppShell>
    );
  }

  const cards = [
    {
      icon: Trophy,
      label: "Taux de réussite",
      value: `${stats.globalRate}%`,
      hint: `${stats.totalCorrect}/${stats.totalQuestions} bonnes réponses`,
      color: "bg-mint-100 text-mint-600",
    },
    {
      icon: Target,
      label: "Questions répondues",
      value: String(stats.totalQuestions),
      hint: `dont ${stats.weakTopics.length} notion${stats.weakTopics.length > 1 ? "s" : ""} à revoir`,
      color: "bg-primary/10 text-primary",
    },
    {
      icon: Clock,
      label: "Temps de révision",
      value: `${stats.studyMinutes} min`,
      hint: "via les quiz terminés",
      color: "bg-amber-100 text-amber-600",
    },
    {
      icon: Flame,
      label: "Exercices scannés",
      value: String(stats.scansCount),
      hint: `${stats.quizzesCount} quiz terminés`,
      color: "bg-rose-100 text-rose-500",
    },
  ];

  const subjectData = stats.bySubject.map((s) => ({
    name: s.subject,
    rate: s.rate,
    total: s.total,
  }));

  const activityData = stats.activity.filter(
    (d) => d.scans > 0 || d.quizzes > 0,
  );

  return (
    <AppShell
      title="Progression"
      subtitle="Ton taux de réussite par matière, tes notions faibles et ton activité."
    >
      {/* Cartes stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-2xl p-5">
            <div className={cn("flex size-10 items-center justify-center rounded-xl", c.color)}>
              <c.icon className="size-5" />
            </div>
            <p className="mt-3 text-2xl font-extrabold tracking-tight">{c.value}</p>
            <p className="text-sm font-medium">{c.label}</p>
            <p className="text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* % par matière */}
        <div className="glass-card rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Réussite par matière</h3>
            <TrendingUp className="size-4 text-primary" />
          </div>
          {subjectData.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Termine un quiz pour voir tes taux de réussite par matière.
            </p>
          ) : (
            <div className="mt-5 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectData} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => `${subjectEmoji(v)} ${v}`}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}% de réussite`, "Taux"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7" }}
                  />
                  <Bar dataKey="rate" fill="#4f46e5" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Notions faibles */}
        <div className="glass-card rounded-3xl p-6">
          <h3 className="font-bold">Notions à revoir</h3>
          {stats.weakTopics.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-mint-200/80 bg-mint-50/60 p-5 text-sm text-mint-700">
              <p className="font-bold">Rien à signaler 🎉</p>
              <p className="mt-1 text-mint-700/80">
                Aucune notion sous la barre des 60% de réussite.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {stats.weakTopics.map((w) => (
                <div
                  key={w.topic}
                  className="flex items-center justify-between rounded-2xl border border-amber-200/70 bg-amber-50/50 p-3.5"
                >
                  <span className="text-sm font-medium">{w.topic}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {w.rate}% · {w.total} réponses
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Refais un quiz ciblé sur ces notions depuis l'onglet Révision.
          </p>
        </div>
      </div>

      {/* Activité 30 jours */}
      <div className="glass-card mt-6 rounded-3xl p-6">
        <h3 className="font-bold">Activité — 30 derniers jours</h3>
        {activityData.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ton activité apparaîtra ici dès tes premiers scans et quiz.
          </p>
        ) : (
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.activity} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={2}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid #e4e4e7" }}
                />
                <Bar dataKey="scans" name="Scans" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="quizzes" name="Quiz" fill="#ff6b4a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </AppShell>
  );
}
