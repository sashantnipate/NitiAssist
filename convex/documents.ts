import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const registerUploaded = mutation({
  args: {
    objectKey: v.string(),
    filename: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);
    if (!args.objectKey.startsWith(`${identity.subject}/`)) {
      throw new Error("Invalid object key");
    }
    if (!ALLOWED_IMAGE_TYPES.includes(args.mimeType) || args.size <= 0 || args.size > MAX_IMAGE_SIZE) {
      throw new Error("Unsupported image type or size");
    }

    const existing = await ctx.db
      .query("documents")
      .withIndex("by_object_key", (q) => q.eq("objectKey", args.objectKey))
      .unique();
    if (existing) {
      if (existing.ownerId !== identity.subject) throw new Error("Unauthorized access");
      return existing._id;
    }

    return await ctx.db.insert("documents", {
      ...args,
      ownerId: identity.subject,
      status: "processing",
      createdAt: Date.now(),
    });
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);
    return await ctx.db
      .query("documents")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const deleteMine = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.ownerId !== identity.subject) {
      throw new Error("Image not found or unauthorized");
    }
    await ctx.db.delete(args.documentId);
  },
});

export const getForAgent = query({
  args: {
    conversationId: v.id("conversations"),
    documentIds: v.array(v.id("documents")),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!process.env.INNGEST_CONVEX_SECRET || args.serviceSecret !== process.env.INNGEST_CONVEX_SECRET) {
      throw new Error("Unauthorized service request");
    }
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const documents = await Promise.all([...new Set(args.documentIds)].map(async (id) => {
      const document = await ctx.db.get(id);
      if (!document || document.ownerId !== conversation.ownerId) {
        throw new Error("Image not found or unauthorized");
      }
      return document;
    }));
    return documents;
  },
});

export const saveDescription = mutation({
  args: {
    documentId: v.id("documents"),
    description: v.string(),
    status: v.union(v.literal("ready"), v.literal("failed")),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (!process.env.INNGEST_CONVEX_SECRET || args.serviceSecret !== process.env.INNGEST_CONVEX_SECRET) {
      throw new Error("Unauthorized service request");
    }
    const document = await ctx.db.get(args.documentId);
    if (!document) return;
    await ctx.db.patch(args.documentId, {
      description: args.description,
      status: args.status,
    });
  },
});
