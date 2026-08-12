import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Download,
  ListChecks,
  MoreHorizontal,
  Smartphone,
  SquareArrowUp,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DeferredPrompt = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandaloneEnv(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Bouton « Ajouter à l'écran d'accueil » (PWA).
 *
 * - Déjà installée (mode standalone) → aucun bouton.
 * - Chrome/Edge (Android ou desktop) → invite d'installation native
 *   (événement beforeinstallprompt).
 * - iOS (Safari) → guide en 3 étapes (icône de partage → écran d'accueil → ajouter).
 * - Autre navigateur desktop → message « ouvre depuis ton téléphone ».
 */
export function InstallApp({
  variant = "compact",
}: {
  variant?: "compact" | "sidebar";
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredPrompt | null>(null);
  const [open, setOpen] = useState(false);

  const isStandalone = useMemo(() => isStandaloneEnv(), []);
  const isIOS = useMemo(
    () => /iP(hone|ad|od)/.test(navigator.userAgent),
    [],
  );
  const isAndroid = useMemo(() => /Android/i.test(navigator.userAgent), []);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as DeferredPrompt);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (isStandalone) return null;

  const handleClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setDeferredPrompt(null);
      return;
    }
    setOpen(true);
  };

  const label = (
    <>
      <Download className="size-3.5 shrink-0" />
      APP
    </>
  );

  return (
    <>
      {variant === "sidebar" ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white/10"
        >
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-[10px] font-bold tracking-wide text-foreground transition-colors hover:bg-white/15"
          title="Ajouter StudySnap à ton écran d'accueil"
        >
          {label}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm rounded-3xl border border-white/10 bg-[#1c1c22] text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-extrabold">
              <Smartphone className="size-5 text-primary" />
              Ajouter StudySnap à ton écran d&apos;accueil
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-muted-foreground">
              Installe l&apos;app pour l&apos;ouvrir comme une vraie application,
              même sans connexion à l&apos;onglet.
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="mt-2 space-y-4">
              {[
                {
                  icon: SquareArrowUp,
                  text: "Appuie sur l'icône de partage (carré avec une flèche vers le haut), en bas de Safari.",
                },
                {
                  icon: ListChecks,
                  text: "Fais défiler la liste et sélectionne « Sur l'écran d'accueil ».",
                },
                {
                  icon: Check,
                  text: "Appuie sur « Ajouter » : l'icône StudySnap apparaît sur ton écran d'accueil.",
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-4" />
                  </span>
                  <p className="pt-1 text-sm leading-6 text-muted-foreground">
                    <span className="mr-1.5 font-bold text-foreground">{i + 1}.</span>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : isAndroid ? (
            <ol className="mt-2 space-y-4">
              {[
                {
                  icon: MoreHorizontal,
                  text: "Appuie sur le menu (trois points ⋮, en haut à droite du navigateur).",
                },
                {
                  icon: Download,
                  text: "Sélectionne « Ajouter à l'écran d'accueil » ou « Installer l'application ».",
                },
                {
                  icon: Check,
                  text: "Confirme : l'icône StudySnap est ajoutée à ton écran d'accueil.",
                },
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <step.icon className="size-4" />
                  </span>
                  <p className="pt-1 text-sm leading-6 text-muted-foreground">
                    <span className="mr-1.5 font-bold text-foreground">{i + 1}.</span>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-muted-foreground">
              📱 Ouvre StudySnap depuis ton <strong className="text-foreground">téléphone</strong>{" "}
              pour l&apos;installer sur ton écran d&apos;accueil. Sur ordinateur,
              utilise « Installer l&apos;application » depuis la barre d&apos;adresse
              de Chrome ou Edge.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
