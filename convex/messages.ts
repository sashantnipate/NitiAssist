import {v} from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

export const createMessageUser = mutation({
    args:{
        conversationId: v.id("conversations"),
        content: v.string(),
        documentIds: v.optional(v.array(v.id("documents"))),
    },
    handler: async(ctx, args) => {

        const identity = await verifyAuth(ctx);

        const conversation = await ctx.db.get(args.conversationId);

        if(!conversation){
            throw new Error("Conversation not found");
        }

        if (conversation.ownerId !== identity.subject) {
            throw new Error("Unauthorized access");
        }

        const documentIds = [...new Set(args.documentIds ?? [])];
        for (const documentId of documentIds) {
            const document = await ctx.db.get(documentId);
            if (!document || document.ownerId !== identity.subject) {
                throw new Error("Image not found or unauthorized");
            }
        }

        
        await ctx.db.patch(args.conversationId, {
            updateAt: Date.now(),
        });

        const userMessageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            role: "user",
            content: args.content,
            ...(documentIds.length ? { documentIds } : {}),
            status: "completed",
        });

        const assistantMessageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            role: "assistant",
            content: "",
            status: "processing",
        });


        return {
            userMessageId,
            assistantMessageId,
            conversationId: args.conversationId
        };
    }
})

export const updateAssistantMessage = mutation({
    args:{
        assistantMessageId: v.id("messages"),
        content: v.string(),
        status: v.union(v.literal("processing"), v.literal("completed"), v.literal("cancelled"))
    },
    handler: async(ctx, args) => {

        const message = await ctx.db.get(args.assistantMessageId);

        if(!message){
            throw new Error("Message not found");
        }
        const conversation = await ctx.db.get( message.conversationId)
        if(!conversation){
            throw new Error("Conversation not found");
        }

        
        await ctx.db.patch(args.assistantMessageId, {
            content: args.content,
            status: args.status
        });
    }
})

export const getMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },

  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const conversation = await ctx.db.get(
      "conversations",
      args.conversationId
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.ownerId !== identity.subject) {
      throw new Error("Unauthorized access");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    return await Promise.all(messages.map(async (message) => ({
      ...message,
      documents: await Promise.all((message.documentIds ?? []).map(async (id) => {
        const document = await ctx.db.get(id);
        if (!document || document.ownerId !== identity.subject) return null;
        return {
          _id: document._id,
          objectKey: document.objectKey,
          filename: document.filename,
          mimeType: document.mimeType,
          description: document.description,
          status: document.status,
        };
      })).then((items) => items.filter((item) => item !== null)),
    })));
  },
});

export const getRecentMessages = query({
  args: {
    conversationId: v.id("conversations"),
  },

  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);

    const conversation = await ctx.db.get(
      "conversations",
      args.conversationId
    );

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.ownerId !== identity.subject) {
      throw new Error("Unauthorized access");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .collect();

    const recent = messages
      .filter((message) => message.content.trim().length > 0)
      .slice(0, 10)
      .reverse()
    return await Promise.all(recent.map(async ({ role, content, documentIds }) => {
      const descriptions = await Promise.all((documentIds ?? []).map(async (id) => {
        const document = await ctx.db.get(id);
        return document?.ownerId === identity.subject && document.description
          ? `${document.filename}: ${document.description}`
          : null;
      }));
      const imageContext = descriptions.filter(Boolean).join("\n");
      return {
        role,
        content: imageContext ? `${content}\n\nAttached image context:\n${imageContext}` : content,
      };
    }));
  },
});
