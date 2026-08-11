import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getOrCreateUsage, getPlan } from "./usage";
import { demoSheet, hashSeed } from "./demoData";
import { assertParentalConsent } from "./users";

export const sheetContentValidator = v.object({
  concepts: v.array(v.object({ term: v.string(), definition: v.string() })),
  formulas: v.array(v.object({ name: v.string(), formula: v.string() })),
  methods: v.array(v.string()),
  example: v.object({ question: v.string(), solution: v.string() }),
  pitfalls: v.array(v.string()),
  takeaways: v.array(v.string()),
});

/** Enregistre une fiche générée (le plan gratuit en autorise 3 par mois). */
export const createSheet = mutation({
  args: {
    title: v.string(),
    subject: v.string(),
    level: v.string(),
    sourceType: v.union(v.literal("photo"), v.literal("text"), v.literal("scan")),
    storageIds: v.array(v.string()),
    sourceText: v.optional(v.string()),
    content: sheetContentValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertParentalConsent(ctx, userId);

    const plan = await getPlan(ctx, userId);
    const usage = await getOrCreateUsage(ctx, userId);
    if (plan === "free" && usage.sheetsCount >= 3) {
      throw new ConvexError({
        code: "LIMIT_REACHED",
        plan,
        message: "Tu as utilisé tes 3 fiches gratuites de ce mois.",
      });
    }

    const now = Date.now();
    const id = await ctx.db.insert("revision_sheets", {
      userId: userId as never,
      title: args.title,
      subject: args.subject,
      level: args.level,
      sourceType: args.sourceType,
      storageIds: args.storageIds,
      sourceText: args.sourceText,
      content: args.content,
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(usage._id, {
      sheetsCount: usage.sheetsCount + 1,
      updatedAt: now,
    });
    return id;
  },
});

export const listMySheets = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("revision_sheets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getSheet = query({
  args: { sheetId: v.id("revision_sheets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const sheet = await ctx.db.get(args.sheetId);
    if (!sheet || sheet.userId !== userId) return null;
    return sheet;
  },
});

export const deleteSheet = mutation({
  args: { sheetId: v.id("revision_sheets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const sheet = await ctx.db.get(args.sheetId);
    if (!sheet || sheet.userId !== userId) return;
    for (const id of sheet.storageIds) {
      await ctx.storage.delete(id);
    }
    await ctx.db.delete(args.sheetId);
  },
});

/** Fiche de démonstration réaliste (aucun quota consommé). */
export const createDemoSheet = mutation({
  args: { subject: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    await assertParentalConsent(ctx, userId);
    const rng = hashSeed(userId, Date.now());
    const sheet = demoSheet(rng, args.subject ?? "");
    const now = Date.now();
    return await ctx.db.insert("revision_sheets", {
      userId: userId as never,
      title: sheet.title,
      subject: sheet.subject,
      level: sheet.level,
      sourceType: "text",
      storageIds: [],
      content: sheet.content,
      createdAt: now,
      updatedAt: now,
    });
  },
});
