import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getOrCreateUsage, getPlan } from "./usage";
import { demoAnalysis, hashSeed } from "./demoData";
import { assertParentalConsent } from "./users";
import { assertUserOwnsAllStorage } from "./files";
import { gateDocument } from "../lib/gating";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

const SCAN_MIN_INTERVAL_MS = 4000;

/** Types MIME d'images autorisés pour l'upload (vérifié côté serveur). */
const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/avif",
]);

export const analysisValidator = v.object({
  detection: v.object({
    subject: v.string(),
    topic: v.string(),
    level: v.string(),
    prompt: v.string(),
    data: v.string(),
    formulas: v.array(v.string()),
    legible: v.boolean(),
  }),
  quick: v.object({
    answer: v.string(),
    calculation: v.string(),
    keyPoint: v.string(),
  }),
  explain: v.object({
    question: v.string(),
    importantInfo: v.array(v.string()),
    method: v.string(),
    steps: v.array(v.string()),
    result: v.string(),
    commonMistake: v.string(),
  }),
  revise: v.object({
    lesson: v.string(),
    keyFormulas: v.array(v.string()),
    exercises: v.array(
      v.object({ question: v.string(), answer: v.string(), hint: v.string() }),
    ),
  }),
  // Document complet corrigé (un bloc par exercice de l'énoncé) — le
  // contenu exportable en PDF, réservé aux plans payants (aperçu gratuit
  // masqué côté serveur via getScan).
  document: v.object({
    title: v.string(),
    exercises: v.array(
      v.object({
        number: v.number(),
        question: v.string(),
        answer: v.string(),
        calculation: v.string(),
      }),
    ),
  }),
});

/**
 * Enregistre un scan terminé.
 * Applique le rate limiting (4 s entre deux scans) et la limite du plan
 * gratuit (4 scans / mois). Le message d'upgrade n'apparaît que lorsque la
 * limite gratuite est atteinte — jamais avant.
 */
export const recordScan = mutation({
  args: {
    storageIds: v.array(v.string()),
    contentTypes: v.optional(v.array(v.string())),
    analysis: analysisValidator,
    mode: v.union(v.literal("quick"), v.literal("explain"), v.literal("revise")),
    fullText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertParentalConsent(ctx, userId);

    // Validation serveur des types MIME annoncés (jamais de confiance au
    // client seul) — l'extension n'est jamais utilisée comme preuve.
    if (
      args.contentTypes &&
      args.contentTypes.some((t) => !ALLOWED_IMAGE_MIME.has(t))
    ) {
      throw new ConvexError({
        code: "INVALID_UPLOAD",
        message: "Un des fichiers n'est pas une image valide (JPG, PNG, WebP…).",
      });
    }
    // Propriété des fichiers : un storageId d'un autre compte est refusé
    // (empêche de lire/OCR/supprimer l'image d'autrui en devinant son id).
    await assertUserOwnsAllStorage(
      ctx as unknown as QueryCtx,
      userId as Id<"users">,
      args.storageIds,
    );

    const plan = await getPlan(ctx, userId);
    const usage = await getOrCreateUsage(ctx, userId);

    // Rate limiting par utilisateur
    if (usage.lastScanAt && Date.now() - usage.lastScanAt < SCAN_MIN_INTERVAL_MS) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Un petit instant entre deux scans…",
      });
    }

    // Limite du plan gratuit
    if (plan === "free" && usage.scansCount >= 4) {
      throw new ConvexError({
        code: "LIMIT_REACHED",
        plan,
        message: "Tu as utilisé tes 4 scans gratuits de ce mois.",
      });
    }

    const scanId = await ctx.db.insert("scans", {
      userId: userId as never,
      storageIds: args.storageIds,
      ...(args.contentTypes && args.contentTypes.length > 0
        ? { contentTypes: args.contentTypes }
        : {}),
      subject: args.analysis.detection.subject,
      topic: args.analysis.detection.topic,
      level: args.analysis.detection.level,
      title: args.analysis.detection.topic || args.analysis.detection.prompt.slice(0, 60),
      fullText: args.fullText?.slice(0, 20000),
      status: "done",
      mode: args.mode,
      result: args.analysis,
      createdAt: Date.now(),
    });

    await ctx.db.patch(usage._id, {
      scansCount: usage.scansCount + 1,
      lastScanAt: Date.now(),
      updatedAt: Date.now(),
    });

    return scanId;
  },
});

/** Réaction "utile / pas utile" sur un résultat. */
export const setFeedback = mutation({
  args: { scanId: v.id("scans"), useful: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== userId) return;
    await ctx.db.patch(args.scanId, {
      feedback: { useful: args.useful, createdAt: Date.now() },
    });
  },
});

export const toggleSaved = mutation({
  args: { scanId: v.id("scans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== userId) return;
    await ctx.db.patch(args.scanId, { saved: !scan.saved });
  },
});

export const deleteScan = mutation({
  args: { scanId: v.id("scans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== userId) return;
    for (const id of scan.storageIds) {
      await ctx.storage.delete(id);
      const up = await ctx.db
        .query("uploads")
        .withIndex("by_storage", (q) => q.eq("storageId", id))
        .first();
      if (up && up.userId === userId) await ctx.db.delete(up._id);
    }
    await ctx.db.delete(args.scanId);
  },
});

export const listMyScans = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const scans = await ctx.db
      .query("scans")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const plan = await getPlan(ctx, userId);
    if (plan !== "free") return scans;
    // Plan gratuit : le document complet corrigé (réservé aux payants) est
    // retiré des réponses de LISTE — il ne faut pas que le client puisse le
    // lire sans passer par le paywall de la page de résultat.
    return scans.map((s) =>
      s.result
        ? { ...s, result: { ...s.result, document: undefined } }
        : s,
    );
  },
});

export const getScan = query({
  args: { scanId: v.id("scans") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const scan = await ctx.db.get(args.scanId);
    if (!scan || scan.userId !== userId) return null;
    const plan = await getPlan(ctx, userId);
    if (plan === "free" && scan.result?.document) {
      // Paywall côté serveur : le plan gratuit reçoit UNIQUEMENT l'aperçu
      // (premier exercice visible, reste masqué) — jamais le contenu complet.
      return {
        ...scan,
        result: {
          ...scan.result,
          document: gateDocument(scan.result.document),
        },
      };
    }
    return scan;
  },
});

/** Crée un exercice de démonstration réaliste (aucune image, aucun quota consommé). */
export const createDemoScan = mutation({
  args: { subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertParentalConsent(ctx, userId);

    const rng = hashSeed(userId, Date.now());
    const analysis = demoAnalysis(rng);
    const subject = args.subject ?? analysis.detection.subject;

    return await ctx.db.insert("scans", {
      userId: userId as never,
      storageIds: [],
      subject,
      topic: analysis.detection.topic,
      level: analysis.detection.level,
      title: analysis.detection.topic,
      status: "done",
      mode: "explain",
      result: analysis,
      createdAt: Date.now(),
    });
  },
});

/** Interne (cron) : scans dont les images doivent être purgées. */
export const listScansForCleanup = internalQuery({
  args: { cutoff: v.number() },
  handler: async (ctx, args) => {
    const scans = await ctx.db.query("scans").collect();
    return scans
      .filter((s) => s.createdAt < args.cutoff && s.storageIds.length > 0)
      .map((s) => ({ _id: s._id, storageIds: s.storageIds }));
  },
});

/** Interne (cron) : vide le champ images d'un scan après purge. */
export const clearScanImages = internalMutation({
  args: { scanId: v.id("scans") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, { storageIds: [] });
  },
});

