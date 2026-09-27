import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    conversations: defineTable({
        title: v.string(),
        ownerId: v.string(),
        updateAt: v.number(),
    }).index("by_owner", ["ownerId"]),
    
    messages: defineTable({
        conversationId : v.id("conversations"),
        role: v.union(v.literal("user"), v.literal("assistant")),
        content: v.string(),
        status: v.optional(
            v.union(
                v.literal("processing"),
                v.literal("completed"),
                v.literal("cancelled")
            )
        ),
    }).index("by_conversation", ["conversationId"]),
})