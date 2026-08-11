import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Génère une URL d'upload pour une image (stockage Convex).
 * L'image est stockée avec une URL signée temporaire ; la suppression
 * automatique est gérée par la tâche planifiée (voir crons.ts).
 */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/** Résout une URL signée temporaire pour une image stockée. */
export const getStorageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
