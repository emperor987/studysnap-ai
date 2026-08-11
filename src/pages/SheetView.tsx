import { AppShell } from "@/components/app-shell";
import { Markdown } from "@/components/markdown";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { levelLabel, subjectEmoji } from "@/lib/format";
import type { Id } from "@/convex/_generated/dataModel";

export default function SheetView() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const sheet = useQuery(api.revisionSheets.getSheet, {
    sheetId: sheetId as Id<"revision_sheets">,
  });
  const deleteSheet = useMutation(api.revisionSheets.deleteSheet);

  if (!sheet) {
    return (
      <AppShell title="Fiche">
        <p className="text-muted-foreground">Chargement de la fiche…</p>
      </AppShell>
    );
  }

  const handleDelete = async () => {
    await deleteSheet({ sheetId: sheet._id });
    toast.success("Fiche supprimée");
    navigate("/sheets");
  };

  const c = sheet.content;

  return (
    <AppShell
      title={sheet.title}
      subtitle="Fiche de révision"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-semibold text-foreground">
          {subjectEmoji(sheet.subject)} {sheet.subject}
        </span>
        <span className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          {levelLabel(sheet.level)}
        </span>
        <span className="glass-chip rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
          {sheet.sourceType === "photo"
            ? "📷 Depuis photo"
            : sheet.sourceType === "scan"
              ? "📸 Depuis un scan"
              : "✍️ Depuis texte"}
        </span>
        <button
          type="button"
          onClick={handleDelete}
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-rose-50 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Supprimer
        </button>
      </div>

      <div className="mt-6 space-y-5">
        {/* Concepts */}
        <section className="glass-card rounded-3xl p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <BookOpen className="size-5 text-primary" />
            Concepts & définitions
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {c.concepts.map((concept, i) => (
              <div key={i} className="rounded-2xl border border-white/70 bg-white/60 p-4">
                <p className="text-sm font-bold text-primary">{concept.term}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {concept.definition}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Formules */}
        {c.formulas.length > 0 && (
          <section className="glass-card rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <Zap className="size-5 text-primary" />
              Formules clés
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {c.formulas.map((f, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3"
                >
                  <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
                    {f.name}
                  </p>
                  <div className="mt-1 font-mono text-sm">
                    <Markdown content={f.formula} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Méthodes */}
        {c.methods.length > 0 && (
          <section className="glass-card rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <ListChecks className="size-5 text-primary" />
              Méthodes à connaître
            </h2>
            <ul className="mt-4 space-y-3">
              {c.methods.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm leading-6">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <Markdown content={m} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Exemple */}
        <section className="glass-card rounded-3xl p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <Lightbulb className="size-5 text-primary" />
            Exemple type
          </h2>
          <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-5">
            <p className="text-sm font-semibold">{c.example.question}</p>
            <div className="mt-3 rounded-xl bg-mint-50/70 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-mint-600">
                ✓ Solution
              </p>
              <div className="mt-1 text-sm leading-6">
                <Markdown content={c.example.solution} />
              </div>
            </div>
          </div>
        </section>

        {/* Pièges */}
        {c.pitfalls.length > 0 && (
          <section className="glass-card rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <AlertTriangle className="size-5 text-amber-500" />
              Pièges à éviter
            </h2>
            <ul className="mt-4 space-y-2.5">
              {c.pitfalls.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3.5 text-sm leading-6"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  {p}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* À retenir */}
        <section className="glass-panel rounded-3xl p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="size-5 text-mint-600" />
            À retenir
          </h2>
          <ul className="mt-4 space-y-2">
            {c.takeaways.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm leading-6">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint-500" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to={`/revision?subject=${encodeURIComponent(sheet.subject)}`}
          className="inline-flex items-center gap-2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/20 transition-all hover:brightness-110"
        >
          <Sparkles className="size-4" />
          Générer un quiz sur cette matière
        </Link>
        <Link
          to="/sheets"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="size-4" />
          Toutes mes fiches
        </Link>
      </div>
    </AppShell>
  );
}
