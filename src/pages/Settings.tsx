import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import {
  BadgeCheck,
  Check,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { levelLabel } from "@/lib/format";

const LEVELS = ["college", "seconde", "premiere", "terminale", "postbac"];
const LANGUAGES = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
];
const EXPLANATION_LEVELS = [
  { id: "simple", label: "Très simple", desc: "Concepts de base, vocabulaire simple" },
  { id: "normal", label: "Normal", desc: "Le niveau lycée, sans jargon inutile" },
  { id: "detail", label: "Détaillé", desc: "Explications complètes et rigoureuses" },
  { id: "expert", label: "Expert", desc: "Prépa / concours, vocabulaire technique" },
];

export default function Settings() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const plan = useQuery(api.subscriptions.getMyPlan);
  const subjects = useQuery(api.subjects.listSubjects);
  const updateProfile = useMutation(api.users.updateProfile);

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [schoolLevel, setSchoolLevel] = useState(user?.schoolLevel ?? "seconde");
  const [favoriteSubjects, setFavoriteSubjects] = useState<string[]>(
    user?.favoriteSubjects ?? [],
  );
  const [language, setLanguage] = useState(user?.language ?? "fr");
  const [explanationLevel, setExplanationLevel] = useState(
    user?.explanationLevel ?? "normal",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.schoolLevel) setSchoolLevel(user.schoolLevel);
    if (user?.favoriteSubjects) setFavoriteSubjects(user.favoriteSubjects);
    if (user?.language) setLanguage(user.language);
    if (user?.explanationLevel) setExplanationLevel(user.explanationLevel);
  }, [user]);

  useEffect(() => {
    if (searchParams.get("upgraded") === "1") {
      toast.success("Abonnement activé — bienvenue dans ton nouveau plan ! 🎉");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const toggleSubject = (s: string) => {
    setFavoriteSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        firstName: firstName.trim() || undefined,
        schoolLevel,
        favoriteSubjects,
        language,
        explanationLevel,
      });
      toast.success("Profil enregistré !");
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'enregistrer le profil.");
    } finally {
      setSaving(false);
    }
  };

  const planLabel =
    plan?.plan === "free"
      ? "Plan gratuit"
      : plan?.plan === "pro"
        ? "Student Pro"
        : "Student";

  return (
    <AppShell
      title="Paramètres"
      subtitle="Ton profil, ton niveau et tes préférences d'explication."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profil */}
        <section className="glass-card rounded-3xl p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 font-bold">
            <UserRound className="size-5 text-primary" />
            Mon profil
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Prénom
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ton prénom"
                className="h-11"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Niveau scolaire
              </label>
              <Select value={schoolLevel} onValueChange={setSchoolLevel}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {levelLabel(l)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Matières favorites
            </label>
            <div className="flex flex-wrap gap-2">
              {(subjects ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSubject(s)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    favoriteSubjects.includes(s)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-white/6 text-muted-foreground",
                  )}
                >
                  {favoriteSubjects.includes(s) && (
                    <Check className="mr-1 inline size-3" />
                  )}
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Langue
              </label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Niveau d&apos;explication préféré
              </label>
              <Select value={explanationLevel} onValueChange={setExplanationLevel}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPLANATION_LEVELS.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {EXPLANATION_LEVELS.find((l) => l.id === explanationLevel) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {
                EXPLANATION_LEVELS.find((l) => l.id === explanationLevel)
                  ?.desc
              }
            </p>
          )}

          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 h-11 rounded-xl bg-brand-gradient px-8 font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </section>

        {/* Abonnement + confidentialité */}
        <section className="space-y-6">
          <div className="glass-card rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <BadgeCheck className="size-5 text-primary" />
              Abonnement
            </h2>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/6 p-4">
              <div>
                <p className="font-bold">{planLabel}</p>
                <p className="text-xs text-muted-foreground">
                  {plan?.plan === "free"
                    ? "5 scans / 3 fiches / 3 quiz par mois"
                    : plan?.plan === "pro"
                      ? "Tout est illimité + stats avancées"
                      : "Scans, fiches et quiz illimités"}
                </p>
              </div>
              {plan?.plan !== "free" && (
                <span className="rounded-full bg-mint-500/15 px-3 py-1 text-xs font-bold text-mint-300">
                  Actif
                </span>
              )}
            </div>
            <Link
              to="/pricing"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white/8 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/15"
            >
              {plan?.plan === "free" ? (
                <>
                  <Sparkles className="size-4 text-primary" />
                  Passer à Student ou Pro
                </>
              ) : (
                "Gérer mon abonnement"
              )}
            </Link>
          </div>

          <div className="glass-card rounded-3xl p-6">
            <h2 className="flex items-center gap-2 font-bold">
              <ShieldCheck className="size-5 text-mint-300" />
              Données & confidentialité
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm leading-6 text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <Lock className="mt-1 size-4 shrink-0 text-primary" />
                Photos supprimées automatiquement après 30 jours (rétention
                configurable).
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="mt-1 size-4 shrink-0 text-primary" />
                Liens d&apos;accès aux images temporaires et signés.
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="mt-1 size-4 shrink-0 text-primary" />
                Aucune clé IA côté navigateur : tout passe par le serveur.
              </li>
              <li className="flex items-start gap-2.5">
                <Lock className="mt-1 size-4 shrink-0 text-primary" />
                Supprime un exercice à tout moment depuis Mes exercices.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
