import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import {
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import {
  BookOpen,
  FileText,
  ImagePlus,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { formatDateFr, levelLabel, subjectEmoji } from "@/lib/format";
import type { ConvexError } from "convex/values";

export default function Sheets() {
  const navigate = useNavigate();
  const sheets = useQuery(api.revisionSheets.listMySheets);
  const subjects = useQuery(api.subjects.listSubjects);
  const deleteSheet = useMutation(api.revisionSheets.deleteSheet);
  const createDemoSheet = useMutation(api.revisionSheets.createDemoSheet);

  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<"photo" | "text">("photo");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("seconde");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [generating, setGenerating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const generateSheet = useAction(api.ai.generateSheet);
  const createSheet = useMutation(api.revisionSheets.createSheet);

  const handleDemo = async () => {
    try {
      const id = await createDemoSheet({});
      toast.success("Fiche d'exemple créée !");
      navigate(`/sheets/${id}`);
    } catch (e) {
      console.error(e);
      toast.error("Impossible de créer l'exemple.");
    }
  };

  const handleDelete = async (id: string) => {
    await deleteSheet({ sheetId: id as never });
    toast.success("Fiche supprimée");
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let storageIds: string[] = [];
      if (sourceType === "photo") {
        for (const f of files) {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": f.file.type },
            body: f.file,
          });
          if (!res.ok) throw new Error("upload");
          const { storageId } = (await res.json()) as { storageId: string };
          storageIds.push(storageId);
        }
      }
      const generated = await generateSheet({
        storageIds,
        sourceText: sourceType === "text" ? text : undefined,
        subject: subject || undefined,
        level,
      });
      const id = await createSheet({
        title: generated.title,
        subject: generated.subject,
        level: generated.level,
        sourceType,
        storageIds,
        sourceText: sourceType === "text" ? text : undefined,
        content: generated.content,
      });
      toast.success("Fiche générée !");
      setOpen(false);
      setText("");
      setFiles([]);
      navigate(`/sheets/${id}`);
    } catch (e) {
      const code = (e as ConvexError<{ code?: string }>)?.data?.code;
      if (code === "LIMIT_REACHED") {
        toast.error("Limite de 3 fiches gratuites atteinte — passe à Student pour en créer plus.");
      } else {
        console.error(e);
        toast.error("La génération a échoué. Réessaie.");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppShell
      title="Mes fiches de révision"
      subtitle="Concepts, formules, méthodes — l'essentiel de tes cours, prêt à réviser."
    >
      <div className="flex items-center justify-between">
        <Button
          onClick={() => setOpen(true)}
          className="rounded-full bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110"
        >
          <Plus className="mr-1.5 size-4" />
          Nouvelle fiche
        </Button>
        <span className="text-xs text-muted-foreground">
          {sheets?.length ?? "—"}{" "}
          {((sheets?.length ?? 0) > 1 ? "fiches" : "fiche")}
        </span>
      </div>

      {sheets && sheets.length === 0 ? (
        <div className="glass-card mt-6 rounded-3xl p-10 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookOpen className="size-8" />
          </div>
          <h3 className="mt-5 text-xl font-bold">Aucune fiche pour l'instant</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Importe une photo de cours ou colle ton texte : StudySnap génère une
            fiche structurée en quelques secondes.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => setOpen(true)}
              className="rounded-full bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110"
            >
              <Plus className="mr-1.5 size-4" />
              Créer ma première fiche
            </Button>
            <Button
              variant="outline"
              onClick={handleDemo}
              className="rounded-full"
            >
              <Sparkles className="mr-1.5 size-4" />
              Voir une fiche d'exemple
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(sheets ?? []).map((sheet) => (
            <div
              key={sheet._id}
              className="glass-card group relative flex flex-col rounded-3xl p-5 transition-all hover:-translate-y-0.5"
            >
              <Link to={`/sheets/${sheet._id}`} className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {subjectEmoji(sheet.subject)} {sheet.subject}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {levelLabel(sheet.level)}
                  </span>
                </div>
                <h3 className="mt-4 font-bold leading-6">{sheet.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  {sheet.content.concepts.length} concepts ·{" "}
                  {sheet.content.formulas.length} formules ·{" "}
                  {formatDateFr(sheet.createdAt)}
                </p>
              </Link>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">
                  {sheet.sourceType === "photo"
                    ? "📷 Depuis photo"
                    : sheet.sourceType === "scan"
                      ? "📸 Depuis un scan"
                      : "✍️ Depuis texte"}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(sheet._id)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground/60 opacity-0 transition-all hover:bg-rose-50 hover:text-destructive group-hover:opacity-100"
                  title="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de création */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle fiche de révision</DialogTitle>
            <DialogDescription>
              Source du cours (photo ou texte) + matière et niveau. La fiche est
              générée automatiquement.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSourceType("photo")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-colors",
                sourceType === "photo"
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border bg-white/60 text-muted-foreground",
              )}
            >
              <ImagePlus className="size-5" />
              Photos du cours
            </button>
            <button
              type="button"
              onClick={() => setSourceType("text")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition-colors",
                sourceType === "text"
                  ? "border-primary/50 bg-primary/5 text-primary"
                  : "border-border bg-white/60 text-muted-foreground",
              )}
            >
              <Type className="size-5" />
              Coller du texte
            </button>
          </div>

          {sourceType === "photo" ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-8 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            >
              <ImagePlus className="size-6" />
              {files.length === 0
                ? "Importer une ou plusieurs photos de cours"
                : `${files.length} photo${files.length > 1 ? "s" : ""} sélectionnée${files.length > 1 ? "s" : ""} (cliquer pour changer)`}
            </button>
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Colle ici ton cours (définitions, théorèmes, formules…)…"
              rows={6}
            />
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                setFiles(
                  Array.from(e.target.files).map((f) => ({
                    file: f,
                    preview: URL.createObjectURL(f),
                  })),
                );
              }
              e.target.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Matière
              </label>
              <Select value={subject || undefined} onValueChange={setSubject}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Auto-détectée" />
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
                Niveau
              </label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["college", "seconde", "premiere", "terminale", "postbac"].map(
                    (l) => (
                      <SelectItem key={l} value={l}>
                        {levelLabel(l)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={
              generating ||
              (sourceType === "photo" && files.length === 0) ||
              (sourceType === "text" && text.trim().length < 20)
            }
            className="h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Génération de la fiche…
              </>
            ) : (
              <>
                <FileText className="mr-2 size-4" />
                Générer la fiche
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
