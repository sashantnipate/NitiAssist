import {v} from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

export const createMessageUser = mutation({
    args:{
        conversationId: v.id("conversations"),
        content: v.string()
    },
    handler: async(ctx, args) => {

        const identity = await verifyAuth(ctx);

        const conversation = await ctx.db.get(args.conversationId);

        if(!conversation){
            throw new Error("Conversation not found");
        }

        
        await ctx.db.patch(args.conversationId, {
            updateAt: Date.now(),
        });

        const userMessageId = await ctx.db.insert("messages", {
            conversationId: args.conversationId,
            role: "user",
            content: args.content,
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

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});