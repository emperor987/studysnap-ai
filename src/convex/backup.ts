/**
 * StudySnap — Backup Convex → Supabase Postgres
 *
 * Objectif : ne JAMAIS perdre les données même si le plan gratuit Convex
 * est dépassé ou si une purge accidentelle survient.
 *
 * Stratégie :
 *   - Toutes les 6h, un cron déclenche l'export complet de 8 tables métier
 *     vers des tables Supabase dédiées.
 *   - Chaque backup est horodaté : on conserve les 20 derniers snapshots.
 *   - Les snapshots précédents sont purgés automatiquement.
 */

"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { getSupabaseClient } from "./lib/supabase";
import { v } from "convex/values";

// ─── Tables à exporter ──────────────────────────────────────────────────────

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

const MAX_SNAPSHOTS = 20;

// ─── Action : export complet ─────────────────────────────────────────────────

/**
 * Action serveur : exporte toutes les tables Convex vers Supabase.
 * Appelée par le cron toutes les 6h.
 *
 * 1. Lit les lignes via ctx.runQuery(internal.monitoring.getAllTableRows)
 * 2. Sérialise et upsert dans Supabase (batchs de 500)
 * 3. Enregistre un snapshot dans backup_snapshots
 * 4. Purge les snapshots les plus anciens (> 20)
 */
export const runFullBackup = action({
  args: {},
  handler: async (ctx) => {
    const supabase = getSupabaseClient();
    const errors: string[] = [];
    const tableCounts: Record<string, number> = {};
    let totalRows = 0;

    for (const tableName of BACKUP_TABLES) {
      try {
        const rows = (await ctx.runQuery(
          internal.monitoring.getAllTableRows,
          { tableName },
        )) as Array<Record<string, unknown>>;

        if (rows.length === 0) {
          tableCounts[tableName] = 0;
          continue;
        }

        const supabaseRows = rows.map((row) => {
          const { _id, _creationTime, ...rest } = row;
          const flat: Record<string, unknown> = {
            id: String(_id),
            convex_created_at: _creationTime ?? null,
          };
          for (const [key, value] of Object.entries(rest)) {
            if (value !== undefined) {
              flat[key] =
                typeof value === "object" && value !== null
                  ? JSON.stringify(value)
                  : value;
            }
          }
          return flat;
        });

        const BATCH = 500;
        for (let i = 0; i < supabaseRows.length; i += BATCH) {
          const batch = supabaseRows.slice(i, i + BATCH);
          const { error } = await supabase
            .from(tableName)
            .upsert(batch, { onConflict: "id" });
          if (error) {
            throw new Error(
              `[backup] Erreur upsert ${tableName}: ${error.message}`,
            );
          }
        }

        tableCounts[tableName] = supabaseRows.length;
        totalRows += supabaseRows.length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${tableName}: ${msg}`);
        console.error(`[backup] Erreur export ${tableName}:`, err);
      }
    }

    const snapshot = {
      created_at: new Date().toISOString(),
      total_rows: totalRows,
      table_counts: tableCounts,
      status: errors.length === 0 ? "ok" : "error",
      ...(errors.length > 0 ? { error_message: errors.join("; ") } : {}),
    };

    const { error: snapErr } = await supabase
      .from("backup_snapshots")
      .insert(snapshot);
    if (snapErr) {
      console.error("[backup] Erreur snapshot:", snapErr.message);
    }

    const { data: allSnaps } = await supabase
      .from("backup_snapshots")
      .select("id")
      .order("created_at", { ascending: false });

    if (allSnaps && allSnaps.length > MAX_SNAPSHOTS) {
      const toDelete = allSnaps.slice(MAX_SNAPSHOTS);
      const ids = toDelete.map((s) => s.id).filter(Boolean);
      if (ids.length > 0) {
        await supabase.from("backup_snapshots").delete().in("id", ids);
      }
    }

    return { totalRows, tableCounts, errors, timestamp: snapshot.created_at };
  },
});

// ─── Action : consulter les backups ──────────────────────────────────────────

export const getRecentBackups = action({
  args: { limit: v.number() },
  handler: async (_ctx, args) => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("backup_snapshots")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(args.limit);
      if (error) throw error;
      return data ?? [];
    } catch (err) {
      console.error("[backup] Erreur lecture snapshots:", err);
      return [];
    }
  },
});

// ─── SQL pour créer les tables Supabase (à exécuter une fois) ────────────────
//
// CREATE TABLE IF NOT EXISTS backup_snapshots (
//   id            BIGSERIAL PRIMARY KEY,
//   created_at    TIMESTAMPTZ DEFAULT NOW(),
//   total_rows    INTEGER,
//   table_counts  JSONB,
//   status        TEXT DEFAULT 'ok',
//   error_message TEXT
// );
// CREATE INDEX idx_backup_time ON backup_snapshots (created_at DESC);
//
// CREATE TABLE IF NOT EXISTS users (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   name TEXT, image TEXT, email TEXT, emailVerificationTime BIGINT,
//   isAnonymous BOOLEAN, role TEXT, firstName TEXT, schoolLevel TEXT,
//   favoriteSubjects TEXT, language TEXT, explanationLevel TEXT,
//   isMinor BOOLEAN, parentEmail TEXT, parentalConsentStatus TEXT,
//   parentalConsentConfirmedAt BIGINT, parentalConsentTokenHash TEXT,
//   parentalConsentTokenExpiresAt BIGINT, parentalConsentLastSentAt BIGINT,
//   parentalConsentReminderSentAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS scans (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, storageIds TEXT, contentTypes TEXT,
//   subject TEXT, topic TEXT, level TEXT, title TEXT, fullText TEXT,
//   status TEXT, mode TEXT, result TEXT, feedback TEXT, saved BOOLEAN,
//   createdAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS quizzes (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, subject TEXT, level TEXT, title TEXT,
//   settings TEXT, questions TEXT, score INTEGER, total INTEGER,
//   durationSeconds INTEGER, status TEXT, createdAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS quiz_answers (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, quizId TEXT, subject TEXT, topic TEXT,
//   questionIndex INTEGER, selected TEXT, isCorrect BOOLEAN,
//   createdAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS revision_sheets (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, title TEXT, subject TEXT, level TEXT,
//   sourceType TEXT, storageIds TEXT, sourceText TEXT,
//   content TEXT, createdAt BIGINT, updatedAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS subscriptions (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, plan TEXT, status TEXT,
//   stripeCustomerId TEXT, stripeSubscriptionId TEXT,
//   periodEnd BIGINT, createdAt BIGINT, updatedAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS usage (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, month TEXT, scansCount INTEGER,
//   sheetsCount INTEGER, quizzesCount INTEGER,
//   lastScanAt BIGINT, updatedAt BIGINT
// );
//
// CREATE TABLE IF NOT EXISTS uploads (
//   id TEXT PRIMARY KEY, convex_created_at BIGINT,
//   userId TEXT, storageId TEXT, contentType TEXT, createdAt BIGINT
// );
//
// -- RLS : service-role only
// ALTER TABLE users ENABLE ROW LEVEL SECURITY;
// ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
// ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
// ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
// ALTER TABLE revision_sheets ENABLE ROW LEVEL SECURITY;
// ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
// ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
// ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
// ALTER TABLE backup_snapshots ENABLE ROW LEVEL SECURITY;
//
// DO $$ BEGIN
//   CREATE POLICY "Service role only" ON users FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON scans FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON quizzes FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON quiz_answers FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON revision_sheets FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON subscriptions FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON usage FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON uploads FOR ALL USING (true);
//   CREATE POLICY "Service role only" ON backup_snapshots FOR ALL USING (true);
// EXCEPTION WHEN duplicate_object THEN NULL;
// END $$;
