import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Coquille commune des pages légales : header sobre avec retour à l'accueil,
 * contenu centré en colonne de lecture, et lien de contact.
 */
export function LegalLayout({
  badge,
  title,
  subtitle,
  children,
  lastUpdated,
}: {
  badge: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  lastUpdated?: string;
}) {
  return (
    <div className="min-h-screen text-foreground">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight">
            Study<span className="text-brand-gradient">Snap</span>
          </span>
        </Link>
        <Link
          to="/"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Retour à l&apos;accueil
        </Link>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-24 pt-8 sm:px-8">
        <div className="mb-10">
          <span className="glass-chip inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold text-primary">
            {badge}
          </span>
          <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mt-3 text-base leading-7 text-muted-foreground">{subtitle}</p>
          )}
          {lastUpdated && (
            <p className="mt-3 text-xs text-muted-foreground/80">
              Dernière mise à jour : {lastUpdated}
            </p>
          )}
        </div>
        <div className="space-y-5">{children}</div>
      </main>
    </div>
  );
}

/** Bloc de contenu d'un article / section. */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="glass-card rounded-3xl p-6 sm:p-7">
      <h2 className="text-lg font-bold sm:text-xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

/** Liste à puces stylée pour les sections légales. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tableau simple (données collectées, conservation…). */
export function LegalTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-white/5">
            {head.map((h) => (
              <th
                key={h}
                className="border-b border-white/10 px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-3 align-top text-muted-foreground"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Avertissement « informations à compléter » (entreprise en cours d'immatriculation). */
export function LegalNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-sm leading-6 text-foreground">
      {children}
    </div>
  );
}
