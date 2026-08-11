import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Camera, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTimeFr, modeLabel, subjectColor, subjectEmoji } from "@/lib/format";

export default function History() {
  const scans = useQuery(api.scans.listMyScans);
  const deleteScan = useMutation(api.scans.deleteScan);
  const [subject, setSubject] = useState<string>("all");
  const [search, setSearch] = useState("");

  const subjects = useMemo(() => {
    const set = new Set((scans ?? []).map((s) => s.subject));
    return [...set];
  }, [scans]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (scans ?? []).filter((s) => {
      if (subject !== "all" && s.subject !== subject) return false;
      if (!q) return true;
      const hay = `${s.title} ${s.topic ?? ""} ${s.subject} ${s.fullText ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [scans, subject, search]);

  const handleDelete = async (id: string) => {
    await deleteScan({ scanId: id as never });
    toast.success("Exercice supprimé");
  };

  return (
    <AppShell
      title="Mes exercices"
      subtitle="Tout ton historique de scans, filtrable et recherchable."
    >
      {/* Filtres */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice, une notion…"
            className="h-11 w-full rounded-xl border border-border bg-white/8 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSubject("all")}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
              subject === "all"
                ? "bg-primary text-white"
                : "glass-chip text-muted-foreground",
            )}
          >
            Toutes
          </button>
          {subjects.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSubject(s)}
              className={cn(
                "shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors",
                subject === s
                  ? "bg-primary text-white"
                  : "glass-chip text-muted-foreground",
              )}
            >
              {subjectEmoji(s)} {s}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {scans && scans.length === 0 ? (
        <div className="glass-card mt-6 rounded-3xl p-10 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="size-8" />
          </div>
          <h3 className="mt-5 text-xl font-bold">Aucun exercice scanné</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Scanne ton premier devoir pour le retrouver ici, avec son
            explication et sa fiche de révision.
          </p>
          <Link
            to="/scanner"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
          >
            <Camera className="size-4" />
            Scanner un exercice
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Aucun résultat pour ces filtres.
            </div>
          )}
          {filtered.map((scan) => (
            <div
              key={scan._id}
              className="glass-card group flex items-center gap-4 rounded-2xl p-4"
            >
              <Link
                to={`/scanner/result/${scan._id}`}
                className="flex min-w-0 flex-1 items-center gap-4"
              >
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl text-xl",
                    subjectColor(scan.subject),
                  )}
                >
                  {subjectEmoji(scan.subject)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{scan.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {scan.subject}
                    {scan.topic ? ` · ${scan.topic}` : ""} ·{" "}
                    {formatDateTimeFr(scan.createdAt)}
                  </p>
                </div>
                <span className="hidden shrink-0 rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-muted-foreground sm:block">
                  {modeLabel(scan.mode ?? "explain")}
                </span>
                {scan.saved && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                    ★ Sauvegardé
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(scan._id)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-all hover:bg-rose-500/15 hover:text-destructive group-hover:opacity-100"
                title="Supprimer"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
