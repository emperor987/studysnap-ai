import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";

/**
 * Sécurité du stockage d'images.
 *
 * - `generateUploadUrl` exige une session (sinon n'importe qui pourrait
 *   remplir le stockage) ;
 * - chaque fichier téléversé est enregistré dans la table `uploads`
 *   (storageId → userId) via `registerUpload` ;
 * - `getStorageUrl` n'est résolu que pour les fichiers du MÊME utilisateur
 *   (via `uploads`, ou via les scans/fiches existants qui le référencent) ;
 * - les actions IA et les mutations d'enregistrement (scan, fiche) vérifient
 *   que chaque storageId appartient bien à l'utilisateur avant de l'utiliser.
 *
 * Sans ces vérifications, un attaquant qui devine un storageId pourrait lire
 * la photo d'un autre compte (BOLA), l'attacher à son propre scan puis la
 * supprimer (suppression croisée), ou faire OCR une image privée d'autrui.
 */

/** Génère une URL d'upload signée et temporaire (session requise). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError({ code: "UNAUTHENTICATED" });
    }
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Enregistre un fichier téléversé comme appartenant à l'utilisateur connecté.
 * Idempotent : si le storageId est déjà enregistré, on renvoie simplement
 * qui en est propriétaire (l'attaquant ne peut pas "capturer" un fichier
 * d'autrui).
 */
export const registerUpload = mutation({
  args: {
    storageId: v.string(),
    contentType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError({ code: "UNAUTHENTICATED" });
    if (!args.storageId || args.storageId.length > 200) {
      throw new ConvexError({
        code: "INVALID_UPLOAD",
        message: "Identifiant de fichier invalide.",
      });
    }
    const existing = await ctx.db
      .query("uploads")
      .withIndex("by_storage", (q) => q.eq("storageId", args.storageId))
      .first();
    if (existing) {
      return { registered: false, owned: existing.userId === userId };
    }
    await ctx.db.insert("uploads", {
      userId: userId as Id<"users">,
      storageId: args.storageId,
      ...(args.contentType ? { contentType: args.contentType } : {}),
      createdAt: Date.now(),
    });
    return { registered: true, owned: true };
  },
});

/** L'utilisateur est-il propriétaire du fichier ? (uploads OU ses scans/fiches). */
export async function userOwnsStorage(
  ctx: QueryCtx,
  userId: Id<"users">,
  storageId: string,
): Promise<boolean> {
  const reg = await ctx.db
    .query("uploads")
    .withIndex("by_storage", (q) => q.eq("storageId", storageId))
    .first();
  if (reg && reg.userId === userId) return true;

  // Rétro-compatibilité : un scan/fiche existant (créé avant le registre)
  // référence ce fichier pour cet utilisateur.
  const scans = await ctx.db
    .query("scans")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  if (scans.some((s) => s.storageIds.includes(storageId))) return true;
  const sheets = await ctx.db
    .query("revision_sheets")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return sheets.some((s) => s.storageIds.includes(storageId));
}

/** Lève INVALID_UPLOAD si un seul storageId n'appartient pas à l'utilisateur. */
export async function assertUserOwnsAllStorage(
  ctx: QueryCtx,
  userId: Id<"users">,
  storageIds: string[],
): Promise<void> {
  for (const id of storageIds) {
    if (!(await userOwnsStorage(ctx, userId, id))) {
      throw new ConvexError({
        code: "INVALID_UPLOAD",
        message: "Un des fichiers ne t'appartient pas.",
      });
    }
  }
}

/** Résout une URL signée temporaire (propriétaire uniquement). */
export const getStorageUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    if (!(await userOwnsStorage(ctx, userId, args.storageId))) return null;
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Interne (actions IA "use node") : vérifie la propriété d'une liste de
 * storageIds sans exposer la table `uploads` au client.
 */
export const checkStorageOwnership = internalQuery({
  args: { storageIds: v.array(v.string()), userId: v.id("users") },
  handler: async (ctx, args) => {
    const owned: Record<string, boolean> = {};
    for (const id of args.storageIds) {
      owned[id] = await userOwnsStorage(ctx, args.userId, id);
    }
    return { owned };
  },
});
