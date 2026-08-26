/**
 * StudySnap — Convex Health Monitoring + Backup (Plan Gratuit)
 *
 * Limites du plan Hobby gratuit :
 *   - Database rows  : 1 000 000 lignes max (toutes tables confondues)
 *   - Database size  : 1 Go max
 *   - File storage   : 1 Go max
 *   - Bandwidth      : 1 Go/mois egress
 *   - Function calls : 1 000 000/mois
 *   - Cron jobs      : 1 000 invocations/mois
 *
 * Ce module fournit des internalMutation/internalQuery appélés par les crons.
 * Les parties "use node" (email alert, Supabase backup) sont dans des
 * modules séparés appelés depuis les actions admin ou le dashboard.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { ConvexError } from "convex/values";

// ─── Limites du plan gratuit ─────────────────────────────────────────────────

const FREE_TIER_LIMITS = {
  maxRows: 1_000_000,
  maxDbBytes: 1_024 * 1024 * 1024,
  maxFileBytes: 1_024 * 1024 * 1024,
} as const;

const TABLES_TO_MONITOR = [
  "users",
  "scans",
  "quizzes",
  "quiz_answers",
  "revision_sheets",
  "subscriptions",
  "usage",
  "uploads",
  "rate_limits",
  "security_events",
  "stripe_config",
] as const;

type TableName = (typeof TABLES_TO_MONITOR)[number];

const BACKUP_TABLES = [
  "users",
  "scans",
  "quizzes",
  "quiz_answers",
  "revision_sheets",
  "subscriptions",
  "usage",
  "uploads",
] as const;

// ─── Seuils ─────────────────────────────────────────────────────────────────

function getWarnThreshold(): number {
  return parseInt(process.env.MONITOR_ROWS_WARN ?? "70", 10) || 70;
}

function getCritThreshold(): number {
  return parseInt(process.env.MONITOR_ROWS_CRIT ?? "90", 10) || 90;
}

// ─── Queries ────────────────────────────────────────────────────────────────

export const getTableCounts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const table of TABLES_TO_MONITOR) {
      const rows = await ctx.db.query(table as TableName).collect();
      counts[table] = rows.length;
      total += rows.length;
    }
    return { counts, total };
  },
});

export const getLastSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => {
    const snapshots = await ctx.db
      .query("health_snapshots")
      .order("desc")
      .take(1);
    return snapshots[0] ?? null;
  },
});

export const getRecentSnapshots = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("health_snapshots")
      .order("desc")
      .take(args.limit);
  },
});

export const getSnapshotsRange = internalQuery({
  args: { hours: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.hours * 60 * 60 * 1000;
    return await ctx.db
      .query("health_snapshots")
      .filter((q) => q.gte(q.field("timestamp"), cutoff))
      .order("asc")
      .collect();
  },
});

/**
 * Récupère toutes les lignes d'une table pour le backup.
 */
export const getAllTableRows = internalQuery({
  args: { tableName: v.string() },
  handler: async (ctx, args) => {
    const allowed = [...BACKUP_TABLES];
    if (!(allowed as readonly string[]).includes(args.tableName)) {
      throw new ConvexError({
        code: "INVALID_TABLE",
        message: `Table non autorisée: ${args.tableName}`,
      });
    }
    // @ts-expect-error — dynamic table access pour le backup
    return await ctx.db.query(args.tableName).collect();
  },
});

export const getBackupTables = internalQuery({
  args: {},
  handler: async () => {
    return [...BACKUP_TABLES];
  },
});

// ─── Mutations ──────────────────────────────────────────────────────────────

/**
 * Enregistre un snapshot d'health. Appelé par le cron toutes les 6h.
 * Log les alertes dans les logs Convex (dashboard).
 */
export const recordHealthSnapshot = internalMutation({
  args: {},
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    let totalRows = 0;
    for (const table of TABLES_TO_MONITOR) {
      const rows = await ctx.db.query(table as TableName).collect();
      counts[table] = rows.length;
      totalRows += rows.length;
    }

    const scans = await ctx.db.query("scans").collect();
    const sheets = await ctx.db.query("revision_sheets").collect();
    let storageRefCount = 0;
    for (const s of scans) storageRefCount += s.storageIds.length;
    for (const s of sheets) storageRefCount += s.storageIds.length;

    const rowsPercent = Math.round(
      (totalRows / FREE_TIER_LIMITS.maxRows) * 100,
    );
    const estimatedDbBytes = totalRows * 3 * 1024;
    const dbPercent = Math.round(
      (estimatedDbBytes / FREE_TIER_LIMITS.maxDbBytes) * 100,
    );

    let biggestTable = "";
    let biggestCount = 0;
    for (const [table, count] of Object.entries(counts)) {
      if (count > biggestCount) {
        biggestCount = count;
        biggestTable = table;
      }
    }

    let alertLevel: "ok" | "warn" | "critical" = "ok";
    if (rowsPercent >= getCritThreshold()) {
      alertLevel = "critical";
    } else if (rowsPercent >= getWarnThreshold()) {
      alertLevel = "warn";
    }

    const snapshot = {
      timestamp: Date.now(),
      totalRows,
      tableCounts: counts,
      storageRefCount,
      estimatedDbBytes,
      rowsPercent,
      dbPercent,
      biggestTable,
      biggestCount,
      alertLevel,
    };

    await ctx.db.insert("health_snapshots", snapshot);

    // Log alertes pour le dashboard Convex
    if (alertLevel === "critical") {
      console.error(
        `[monitoring] 🚨 CRITIQUE : ${rowsPercent}% des lignes utilisées (${totalRows.toLocaleString("fr-FR")} / 1M). Table principale : ${biggestTable} (${biggestCount.toLocaleString("fr-FR")} lignes)`,
      );
    } else if (alertLevel === "warn") {
      console.warn(
        `[monitoring] ⚠️ AVERTISSEMENT : ${rowsPercent}% des lignes utilisées (${totalRows.toLocaleString("fr-FR")} / 1M)`,
      );
    }

    return snapshot;
  },
});
