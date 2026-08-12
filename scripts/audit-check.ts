/**
 * Contrôle des dépendances pour la CI — `bun run audit:deps`.
 *
 * Comportement :
 *  1. exécute `bun audit --json` (toutes sévérités, dépendances directes ET
 *     transitives) ;
 *  2. retire les advisories listées dans `security/audit-exceptions.json`
 *     (chacune avec justification + date d'expiration — voir SECURITY.md) ;
 *  3. échoue (exit 1) si une advisory restante a une sévérité >= au seuil
 *     configuré (défaut : "high") ;
 *  4. affiche le détail des advisory restantes pour guider la correction.
 *
 * Les exceptions ne sont PAS un moyen de masquer une vulnérabilité : elles
 * expirent et doivent être documentées dans le fichier JSON (raison,
 * analyse d'exploitabilité, date d'échéance).
 *
 * Usage : bun run audit:deps [--level=low|moderate|high|critical]
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");

const SEVERITY_ORDER = ["low", "moderate", "high", "critical"] as const;
type Severity = (typeof SEVERITY_ORDER)[number];

function severityRank(s: string): number {
  const i = SEVERITY_ORDER.indexOf(s as Severity);
  return i === -1 ? 0 : i;
}

type AuditAdvisory = {
  severity: string;
  title: string;
  url?: string;
};

type ExceptionsFile = {
  threshold: string;
  exceptions: { id: string; reason: string; expires: string }[];
};

function loadExceptions(): ExceptionsFile {
  const path = join(ROOT, "security", "audit-exceptions.json");
  try {
    return JSON.parse(readFileSync(path, "utf8")) as ExceptionsFile;
  } catch {
    console.error(
      `✖ Impossible de lire ${path} — le fichier d'exceptions est obligatoire.`,
    );
    process.exit(1);
  }
}

// Sévérité seuil : --level=… en argument, sinon celle du fichier, sinon "high".
const levelArg = process.argv.find((a) => a.startsWith("--level="));
const exceptions = loadExceptions();
const threshold = (levelArg?.split("=")[1] ?? exceptions.threshold ?? "high") as Severity;
if (!SEVERITY_ORDER.includes(threshold)) {
  console.error(`✖ Seuil invalide : ${threshold}`);
  process.exit(1);
}

const audit = spawnSync("bun", ["audit", "--json"], {
  cwd: ROOT,
  encoding: "utf8",
  timeout: 120_000,
});
if (audit.error) {
  console.error("✖ Impossible d'exécuter bun audit :", audit.error.message);
  process.exit(1);
}

let raw: Record<string, AuditAdvisory[]>;
try {
  raw = JSON.parse(audit.stdout || "{}");
} catch {
  console.error("✖ Sortie bun audit illisible (JSON attendu).");
  process.exit(1);
}

const exceptedIds = new Set(exceptions.exceptions.map((e) => e.id));

const findings: { pkg: string; severity: string; title: string; id: string }[] = [];
for (const [pkg, advisories] of Object.entries(raw)) {
  for (const ad of advisories) {
    const id = ad.url?.split("/").pop() ?? ad.title;
    if (exceptedIds.has(id)) continue;
    if (severityRank(ad.severity) >= severityRank(threshold)) {
      findings.push({ pkg, severity: ad.severity, title: ad.title, id });
    }
  }
}

// Sync garde-fou : une exception expirée est signalée (elle doit être revue).
const now = Date.now();
for (const ex of exceptions.exceptions) {
  const expired = ex.expires && new Date(ex.expires).getTime() < now;
  if (expired) {
    console.warn(
      `⚠ Exception expirée dans security/audit-exceptions.json : ${ex.id} ` +
        `(échéance ${ex.expires}) — à réévaluer.`,
    );
  }
}

if (findings.length > 0) {
  console.error(
    `✖ ${findings.length} advisory(ies) >= seuil « ${threshold} » — CI bloquée.\n`,
  );
  for (const f of findings) {
    console.error(`  [${f.severity}] ${f.pkg}: ${f.title} (${f.id})`);
  }
  console.error(
    `\nCorriger en mettant à jour la dépendance (bun update <pkg>), puis relancer. ` +
      `Exception TEMPORAIRE uniquement : ajouter l'id dans security/audit-exceptions.json ` +
      `avec une justification et une date d'expiration (voir SECURITY.md).`,
  );
  process.exit(1);
}

console.log(
  `✓ bun audit : aucune vulnérabilité ≥ « ${threshold} » hors exceptions documentées.`,
);
