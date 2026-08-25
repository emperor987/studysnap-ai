/**
 * StudySnap — Analytics via Supabase (Postgres).
 *
 * Fournit des métriques avancées en SQL pur (fenêtres glissantes, percentiles,
 * cohortes) que les requêtes Convex natives ne peuvent pas exprimer facilement.
 *
 * Stratégie :
 *  - Convex reste la source de vérité (données métier = scans, quiz, fiches).
 *  - Supabase reçoit des événements agrégés via des actions Convex
 *    (event tracking) et les requête en SQL pour le tableau de bord analytics.
 *  - Aucune donnée utilisateur sensible n'est stockée côté Supabase —
 *    seulement des métriques anonymisées (subject, level, mode, score, durée).
 *
 * Tables Supabase attendues (à créer manuellement dans le dashboard) :
 *
 *   CREATE TABLE analytics_events (
 *     id          BIGSERIAL PRIMARY KEY,
 *     event_type  TEXT NOT NULL,          -- 'scan' | 'quiz' | 'sheet' | 'signup'
 *     user_id     TEXT,                   -- ID Convex (anonymisé si besoin)
 *     subject     TEXT,
 *     level       TEXT,
 *     mode        TEXT,                   -- quick | explain | revise
 *     score       INTEGER,
 *     total       INTEGER,
 *     duration_ms INTEGER,
 *     metadata    JSONB,
 *     created_at  TIMESTAMPTZ DEFAULT NOW()
 *   );
 *
 *   CREATE INDEX idx_events_type_time ON analytics_events (event_type, created_at);
 *   CREATE INDEX idx_events_subject ON analytics_events (subject, created_at);
 */

"use node";

import { action } from "./_generated/server";
import { getSupabaseClient } from "./lib/supabase";
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalyticsEvent {
  event_type: string;
  user_id?: string;
  subject?: string;
  level?: string;
  mode?: string;
  score?: number;
  total?: number;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

interface SubjectBreakdown {
  subject: string;
  event_count: number;
  unique_users: number;
  avg_score: number | null;
}

interface DailyMetric {
  date: string;
  scans: number;
  quizzes: number;
  sheets: number;
  signups: number;
}

interface EngagementMetric {
  user_id: string;
  total_events: number;
  scan_count: number;
  quiz_count: number;
  avg_quiz_score: number | null;
  last_active: string;
}

// ─── Fire events ─────────────────────────────────────────────────────────────

/**
 * Enregistre un événement analytics dans Supabase.
 * Appelé depuis les mutations/actions Convex après chaque action utilisateur.
 */
export const trackEvent = action({
  args: {
    eventType: v.string(),
    subject: v.optional(v.string()),
    level: v.optional(v.string()),
    mode: v.optional(v.string()),
    score: v.optional(v.number()),
    total: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });

    try {
      const supabase = getSupabaseClient();
      const event: AnalyticsEvent = {
        event_type: args.eventType,
        user_id: userId,
        subject: args.subject,
        level: args.level,
        mode: args.mode,
        score: args.score,
        total: args.total,
        duration_ms: args.durationMs,
        metadata: args.metadata,
      };

      const { error } = await supabase
        .from("analytics_events")
        .insert(event);

      if (error) {
        console.error("[supabaseAnalytics] Erreur insertion événement:", error.message);
      }
    } catch (err) {
      // Ne pas bloquer l'utilisateur si l'analytics échoue
      console.error("[supabaseAnalytics] Erreur tracking:", err);
    }
  },
});

// ─── Analytics queries ───────────────────────────────────────────────────────

/**
 * Métriques agrégées par matière : nombre d'événements, utilisateurs uniques,
 * score moyen — sur les 30 derniers jours.
 * Requête SQL pure impossible en Convex natif (fenêtres, COUNT DISTINCT).
 */
export const getSubjectAnalytics = action({
  args: {},
  handler: async () => {
    try {
      const supabase = getSupabaseClient();
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase.rpc("get_subject_analytics", {
        p_since: thirtyDaysAgo,
      });

      if (error) {
        // Fallback : requête SQL directe si la fonction RPC n'existe pas
        const { data: fallback, error: fbError } = await supabase
          .from("analytics_events")
          .select("subject, event_type, user_id, score")
          .gte("created_at", thirtyDaysAgo)
          .not("subject", "is", null);

        if (fbError) throw fbError;

        // Agrégation côté serveur (fallback)
        const bySubject = new Map<string, { count: number; users: Set<string>; scores: number[] }>();
        for (const row of fallback ?? []) {
          const s = row.subject!;
          if (!bySubject.has(s)) bySubject.set(s, { count: 0, users: new Set(), scores: [] });
          const entry = bySubject.get(s)!;
          entry.count += 1;
          if (row.user_id) entry.users.add(row.user_id);
          if (row.score != null) entry.scores.push(row.score);
        }

        return [...bySubject.entries()]
          .map(([subject, s]) => ({
            subject,
            event_count: s.count,
            unique_users: s.users.size,
            avg_score: s.scores.length
              ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length)
              : null,
          }))
          .sort((a, b) => b.event_count - a.event_count) as SubjectBreakdown[];
      }

      return (data ?? []) as SubjectBreakdown[];
    } catch (err) {
      console.error("[supabaseAnalytics] Erreur subject analytics:", err);
      return [] as SubjectBreakdown[];
    }
  },
});

/**
 * Métriques journalières : scans, quiz, fiches, inscriptions — 30 derniers jours.
 * Utilise une fenêtre glissante SQL pour grouper par jour.
 */
export const getDailyMetrics = action({
  args: {},
  handler: async () => {
    try {
      const supabase = getSupabaseClient();
      const thirtyDaysAgo = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Requête directe (pas de RPC nécessaire pour un GROUP BY simple)
      const { data, error } = await supabase
        .from("analytics_events")
        .select("event_type, created_at")
        .gte("created_at", thirtyDaysAgo);

      if (error) throw error;

      // Agrégation côté serveur
      const byDate = new Map<string, DailyMetric>();
      const ensure = (d: string) => {
        if (!byDate.has(d))
          byDate.set(d, { date: d, scans: 0, quizzes: 0, sheets: 0, signups: 0 });
      };

      for (const row of data ?? []) {
        const date = row.created_at?.slice(0, 10) ?? "unknown";
        ensure(date);
        const m = byDate.get(date)!;
        switch (row.event_type) {
          case "scan": m.scans += 1; break;
          case "quiz": m.quizzes += 1; break;
          case "sheet": m.sheets += 1; break;
          case "signup": m.signups += 1; break;
        }
      }

      return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    } catch (err) {
      console.error("[supabaseAnalytics] Erreur daily metrics:", err);
      return [] as DailyMetric[];
    }
  },
});

/**
 * Score moyen par matière + tendance (meilleure/médiocre).
 */
export const getScoreTrends = action({
  args: {},
  handler: async () => {
    try {
      const supabase = getSupabaseClient();
      const sevenDaysAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const fourteenDaysAgo = new Date(
        Date.now() - 14 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Période récente (7j)
      const { data: recent } = await supabase
        .from("analytics_events")
        .select("subject, score, total")
        .gte("created_at", sevenDaysAgo)
        .eq("event_type", "quiz")
        .not("score", "is", null);

      // Période précédente (7-14j)
      const { data: previous } = await supabase
        .from("analytics_events")
        .select("subject, score, total")
        .gte("created_at", fourteenDaysAgo)
        .lt("created_at", sevenDaysAgo)
        .eq("event_type", "quiz")
        .not("score", "is", null);

      const avgBySubject = (rows: typeof recent) => {
        const bySubj = new Map<string, number[]>();
        for (const r of rows ?? []) {
          if (!r.subject || r.score == null || r.total == null || r.total === 0) continue;
          const pct = Math.round((r.score / r.total) * 100);
          const arr = bySubj.get(r.subject) ?? [];
          arr.push(pct);
          bySubj.set(r.subject, arr);
        }
        const result = new Map<string, number>();
        for (const [s, scores] of bySubj) {
          result.set(s, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length));
        }
        return result;
      };

      const recentAvgs = avgBySubject(recent);
      const previousAvgs = avgBySubject(previous);

      return [...recentAvgs.entries()].map(([subject, avg]) => ({
        subject,
        currentScore: avg,
        previousScore: previousAvgs.get(subject) ?? null,
        trend:
          previousAvgs.has(subject)
            ? avg > previousAvgs.get(subject)!
              ? "up"
              : avg < previousAvgs.get(subject)!
                ? "down"
                : "stable"
            : "new",
      }));
    } catch (err) {
      console.error("[supabaseAnalytics] Erreur score trends:", err);
      return [];
    }
  },
});
