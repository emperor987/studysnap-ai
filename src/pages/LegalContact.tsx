import { LegalLayout } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Mail, MessageSquareText, Timer } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

const SUBJECTS = [
  { value: "general", label: "Question générale" },
  { value: "support", label: "Support technique" },
  { value: "billing", label: "Facturation" },
  { value: "rgpd", label: "Demande RGPD" },
  { value: "partnership", label: "Partenariat" },
] as const;

const SUBJECT_LABEL: Record<string, string> = Object.fromEntries(
  SUBJECTS.map((s) => [s.value, s.label]),
);

export default function LegalContact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>("general");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const to = "support@studysnap.app";
    const subjectLine = `[${SUBJECT_LABEL[subject]}] ${name}`;
    const body = `Nom : ${name}\nEmail : ${email}\nSujet : ${SUBJECT_LABEL[subject]}\n\n${message}`;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(
      subjectLine,
    )}&body=${encodeURIComponent(body)}`;
    toast.success("Ton client email s'ouvre — il ne reste qu'à envoyer !");
  };

  return (
    <LegalLayout
      badge="✉️ Contact"
      title="Contacte-nous"
      subtitle="Une question, un problème technique, une demande RGPD ? On t'écoute — réponse sous 48 h ouvrées."
    >
      {/* Formulaire */}
      <section className="glass-card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquareText className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold sm:text-lg">Formulaire de contact</h2>
            <p className="text-xs text-muted-foreground">
              Le formulaire ouvre ton client email avec le message pré-rempli.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Nom
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ton nom"
                className="h-11 rounded-xl bg-white/5"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.fr"
                className="h-11 rounded-xl bg-white/5"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Sujet
            </label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="h-11 rounded-xl bg-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              Message
            </label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Décris-nous ta demande…"
              rows={5}
              className="rounded-xl bg-white/5"
              required
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full rounded-xl bg-brand-gradient font-semibold shadow-lg shadow-indigo-500/20 hover:brightness-110 sm:w-auto sm:px-8"
          >
            Envoyer ma demande
            <ArrowRight className="ml-2 size-4" />
          </Button>
        </form>
      </section>

      {/* Infos pratiques */}
      <section className="glass-card rounded-3xl p-6 sm:p-7">
        <h2 className="text-base font-bold sm:text-lg">Infos pratiques</h2>
        <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">Demandes urgentes</strong> —
              écris-nous directement :{" "}
              <a
                href="mailto:support@studysnap.app"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                support@studysnap.app
              </a>
            </p>
          </div>
          <div className="flex items-start gap-3">
            <Timer className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">Délai de réponse</strong> —
              sous 48 h ouvrées en semaine. Les abonnés Student et Student Pro
              sont traités en priorité.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>
              <strong className="text-foreground">Avant d'écrire</strong> — ta
              question a peut-être déjà une réponse dans la{" "}
              <Link
                to="/#faq"
                className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                FAQ StudySnap
              </Link>
              .
            </p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground/80">
            💡 Une demande RGPD ? Utilise le sujet « Demande RGPD » ou écris à
            privacy@studysnap.app — réponse sous 1 mois maximum, comme le
            prévoit le RGPD.
          </p>
        </div>
      </section>
    </LegalLayout>
  );
}
