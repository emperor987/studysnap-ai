import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { CheckCircle2, Clock, Link2Off, ShieldAlert, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";

type Result =
  | { status: "loading" }
  | { status: "confirmed" }
  | { status: "refused" }
  | { status: "expired" }
  | { status: "already_used" }
  | { status: "invalid" };

const CONTENT: Record<Exclude<Result["status"], "loading">, { icon: typeof CheckCircle2; title: string; text: string; tone: "ok" | "warn" | "bad" }> = {
  confirmed: {
    icon: CheckCircle2,
    title: "Accès confirmé ✅",
    text: "L'accès de ton enfant à StudySnap est maintenant activé. Il peut utiliser l'application normalement.",
    tone: "ok",
  },
  refused: {
    icon: UserX,
    title: "Demande refusée",
    text: "La demande a été signalée comme non légitime. Le compte de l'enfant reste bloqué. Si c'est une erreur, contacte le support.",
    tone: "bad",
  },
  expired: {
    icon: Clock,
    title: "Lien expiré",
    text: "Ce lien a expiré (validité 72 h). L'enfant peut renvoyer un nouvel email de confirmation depuis son compte, ou renseigner une autre adresse parent.",
    tone: "warn",
  },
  already_used: {
    icon: Link2Off,
    title: "Lien déjà utilisé",
    text: "Ce lien a déjà été utilisé pour confirmer l'accès. Aucune action supplémentaire n'est nécessaire.",
    tone: "ok",
  },
  invalid: {
    icon: ShieldAlert,
    title: "Lien invalide",
    text: "Ce lien de confirmation n'est pas valide. Vérifie qu'il est complet, ou demande à l'enfant de renvoyer l'email depuis son compte.",
    tone: "bad",
  },
};

function ParentalConsent() {
  const [searchParams] = useSearchParams();
  const confirm = useAction(api.parentalConsent.confirmParentalConsent);
  const [result, setResult] = useState<Result>({ status: "loading" });

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setResult({ status: "invalid" });
      return;
    }
    const decision = searchParams.get("decision") === "refuse" ? "refuse" : "approve";
    confirm({ token, decision })
      .then((res) => setResult({ status: res.status }))
      .catch(() => setResult({ status: "invalid" }));
  }, [searchParams, confirm]);

  const isDone = result.status !== "loading";

  return (
    <div className="bg-glow flex min-h-screen flex-col items-center justify-center bg-background px-5 text-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="text-xl font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>

        <div className="glass-panel rounded-3xl p-8 text-center">
          {!isDone ? (
            <>
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Clock className="size-7 animate-pulse" />
              </div>
              <h1 className="mt-5 text-xl font-extrabold tracking-tight">
                Vérification de la demande…
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                On vérifie la validité du lien de confirmation.
              </p>
            </>
          ) : (
            (() => {
              const c = CONTENT[result.status];
              const Icon = c.icon;
              return (
                <>
                  <div
                    className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${
                      c.tone === "ok"
                        ? "bg-mint-500/15 text-mint-300"
                        : c.tone === "warn"
                          ? "bg-amber-500/10 text-amber-300"
                          : "bg-rose-500/10 text-rose-300"
                    }`}
                  >
                    <Icon className="size-7" />
                  </div>
                  <h1 className="mt-5 text-xl font-extrabold tracking-tight">{c.title}</h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{c.text}</p>
                  {result.status === "confirmed" && (
                    <Link
                      to="/"
                      className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-gradient px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:brightness-110"
                    >
                      Retour à StudySnap
                    </Link>
                  )}
                </>
              );
            })()
          )}
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Une question ? Écris-nous à{" "}
          <a href="mailto:support@studysnap.app" className="text-primary underline">
            support@studysnap.app
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ParentalConsentPage() {
  return (
    <Suspense>
      <ParentalConsent />
    </Suspense>
  );
}
