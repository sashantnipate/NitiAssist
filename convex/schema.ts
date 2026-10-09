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
        documentIds: v.optional(v.array(v.id("documents"))),
        status: v.optional(
            v.union(
                v.literal("processing"),
                v.literal("completed"),
                v.literal("cancelled")
            )
        ),
    }).index("by_conversation", ["conversationId"]),

    documents: defineTable({
        ownerId: v.string(),
        objectKey: v.string(),
        filename: v.string(),
        mimeType: v.string(),
        size: v.number(),
        description: v.optional(v.string()),
        status: v.union(
            v.literal("processing"),
            v.literal("ready"),
            v.literal("failed")
        ),
        createdAt: v.number(),
    })
        .index("by_owner", ["ownerId"])
        .index("by_owner_created", ["ownerId", "createdAt"])
        .index("by_object_key", ["objectKey"]),
})
