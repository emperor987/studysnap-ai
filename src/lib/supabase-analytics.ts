/**
 * StudySnap — Types partagés pour les analytics Supabase.
 *
 * Utilisés par le frontend pour typer les résultats des actions Convex
 * qui interrogent Supabase (getSubjectAnalytics, getDailyMetrics, etc.).
 */

export interface SubjectBreakdown {
  subject: string;
  event_count: number;
  unique_users: number;
  avg_score: number | null;
}

export interface DailyMetric {
  date: string;
  scans: number;
  quizzes: number;
  sheets: number;
  signups: number;
}

export interface ScoreTrend {
  subject: string;
  currentScore: number;
  previousScore: number | null;
  trend: "up" | "down" | "stable" | "new";
}

/** Mapping event_type Convex → Supabase analytics_events.event_type */
export const ANALYTICS_EVENTS = {
  SCAN: "scan",
  QUIZ: "quiz",
  SHEET: "sheet",
  SIGNUP: "signup",
} as const;
