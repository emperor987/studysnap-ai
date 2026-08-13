import { AppShell } from "@/components/app-shell";
import { Markdown } from "@/components/markdown";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileDown,
  Lightbulb,
  ListChecks,
  Sparkles,
  Trash2,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { levelLabel, subjectEmoji } from "@/lib/format";
import { MaskedBlock, UnlockCard, useIsPaid } from "@/components/UnlockGate";
import { buildPdf, downloadPdf, markdownToPlainText, type PdfBlock } from "@/lib/pdf";
import type { Id } from "@/convex/_generated/dataModel";

export default function SheetView() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const sheet = useQuery(api.revisionSheets.getSheet, {
    sheetId: sheetId as Id<"revision_sheets">,
  });
  const deleteSheet = useMutation(api.revisionSheets.deleteSheet);
  const isPaid = useIsPaid();

  if (!sheet) {
    return (
      <AppShell title="Fiche">
        <p className="text-muted-foreground">Chargement de la fiche…</p>
      </AppShell>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteSheet({ sheetId: sheet._id });
      toast.success("Fiche supprimée");
      navigate("/sheets");
    } catch (e) {
      // Fiche déjà supprimée ailleurs, reconnexion… : on reste sur la page et
      // on propose de réessayer — aucun rejet non capté.
      console.error("Suppression impossible :", e);
      toast.error("Impossible de supprimer pour l'instant. Réessaie.");
    }
  };

  const c = sheet.content;
  // Paywall : le serveur ne renvoie qu'un aperçu (quelques concepts) aux
  // comptes gratuits — locked=true. Les payants reçoivent le contenu complet
  // et l'export PDF de marque.
  const locked = sheet.locked === true;

  /** Export PDF de marque de la fiche complète (plan payant). */
  const handleExportPdf = () => {
    if (locked || !isPaid) return;
    const blocks: PdfBlock[] = [
      { type: "h1", text: sheet.title },
      {
        type: "text",
        text: [sheet.subject, levelLabel(sheet.level)].filter(Boolean).join(" · "),
      },
      { type: "divider" },
      { type: "h2", text: "Concepts & définitions" },
      ...c.concepts.flatMap<PdfBlock>((con) => [
        { type: "text", text: `• ${con.term} : ${markdownToPlainText(con.definition)}` },
      ]),
    ];
    if (c.formulas.length > 0) {
      blocks.push({ type: "divider" }, { type: "h2", text: "Formules clés" });
      for (const f of c.formulas) {
        blocks.push({ type: "text", text: `• ${f.name} : ${markdownToPlainText(f.formula)}` });
      }
    }
    if (c.methods.length > 0) {
      blocks.push({ type: "divider" }, { type: "h2", text: "Méthodes à connaître" });
      for (const m of c.methods) blocks.push({ type: "bullet", text: markdownToPlainText(m) });
    }
    if (c.example.question) {
      blocks.push(
        { type: "divider" },
        { type: "h2", text: "Exemple type" },
        { type: "text", text: `Question : ${markdownToPlainText(c.example.question)}` },
        { type: "text", text: `Solution : ${markdownToPlainText(c.example.solution)}` },
      );
    }
    if (c.pitfalls.length > 0) {
      blocks.push({ type: "divider" }, { type: "h2", text: "Pièges à éviter" });
      for (const p of c.pitfalls) blocks.push({ type: "bullet", text: markdownToPlainText(p) });
    }
    if (c.takeaways.length > 0) {
      blocks.push({ type: "divider" }, { type: "h2", text: "À retenir" });
      for (const t of c.takeaways) blocks.push({ type: "bullet", text: markdownToPlainText(t) });
    }
    const pdf = buildPdf({
      title: `StudySnap — ${sheet.title}`,
      subtitle: `Fiche de révision · ${sheet.subject} · ${levelLabel(sheet.level)}`,
      blocks,
    });
    const safeName = (sheet.title || "fiche").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadPdf(pdf, `studysnap-fiche-${safeName}.pdf`);
  };

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
          className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-rose-500/15 hover:text-destructive"
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
              <div key={i} className="rounded-2xl border border-white/10 bg-white/6 p-4">
                <p className="text-sm font-bold text-primary">{concept.term}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {concept.definition}
                </p>
              </div>
            ))}
          </div>
        </section>

        {locked ? (
          <>
            {/* Aperçu gratuit : concepts visibles, le reste masqué + CTA */}
            <MaskedBlock label="Formules clés" />
            <MaskedBlock label="Méthodes à connaître" />
            <MaskedBlock label="Exemple type corrigé" />
            <MaskedBlock label="Pièges à éviter & à retenir" />
            <UnlockCard
              title="La fiche complète est réservée aux abonnés"
              description="Passe à Student ou Student Pro pour débloquer toutes les sections de la fiche et l'exporter en PDF prêt à réviser."
              benefits={[
                "Toutes les formules, méthodes et l'exemple corrigé",
                "Export PDF de marque, prêt à imprimer",
                "Quiz illimités pour vérifier que c'est acquis",
              ]}
            />
          </>
        ) : (
          <>
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
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/6 p-5">
                <p className="text-sm font-semibold">{c.example.question}</p>
                <div className="mt-3 rounded-xl bg-mint-500/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-mint-300">
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
                      className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm leading-6"
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
                <CheckCircle2 className="size-5 text-mint-300" />
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

            {/* Export PDF de marque (plan payant) */}
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-primary/20 bg-primary/5 p-6 sm:flex-row sm:justify-between">
              <div>
                <p className="font-bold">📄 Exporter la fiche en PDF</p>
                <p className="text-sm text-muted-foreground">
                  Document de marque StudySnap, prêt à imprimer ou à partager.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportPdf}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
              >
                <FileDown className="size-4" />
                Exporter en PDF
              </button>
            </div>
          </>
        )}
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
