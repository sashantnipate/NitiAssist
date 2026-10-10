import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

function assertServiceSecret(secret: string) {
  if (!process.env.INNGEST_CONVEX_SECRET || secret !== process.env.INNGEST_CONVEX_SECRET) {
    throw new Error("Unauthorized service request");
  }
}

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
    if (!ALLOWED_DOCUMENT_TYPES.has(args.mimeType) || args.size <= 0 || args.size > MAX_DOCUMENT_SIZE) {
      throw new Error("Unsupported document type or size");
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

export const getForOwner = query({
  args: {
    ownerId: v.string(),
    documentId: v.id("documents"),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.ownerId !== args.ownerId) throw new Error("Document not found.");
    return document;
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
      throw new Error("Document not found or unauthorized");
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

export const listForAgent = query({
  args: {
    conversationId: v.id("conversations"),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", conversation.ownerId))
      .order("desc")
      .take(20);

    return documents.map(({ _id, filename, description, mimeType, status }) => ({
      id: _id,
      filename,
      description: description ?? "",
      mimeType,
      status,
    }));
  },
});

export const saveDescription = mutation({
  args: {
    documentId: v.id("documents"),
    ownerId: v.string(),
    description: v.string(),
    analysisError: v.optional(v.string()),
    filename: v.optional(v.string()),
    status: v.union(v.literal("ready"), v.literal("failed")),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.ownerId !== args.ownerId) return;
    await ctx.db.patch(args.documentId, {
      description: args.description,
      analysisError: args.analysisError ?? "",
      status: args.status,
      ...(args.filename ? { filename: args.filename } : {}),
    });
  },
});

export const markFailedMine = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);
    const document = await ctx.db.get(args.documentId);
    if (!document || document.ownerId !== identity.subject) throw new Error("Document not found.");
    await ctx.db.patch(args.documentId, { status: "failed" });
  },
});
