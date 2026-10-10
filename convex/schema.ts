import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  conversations: defineTable({
    title: v.string(),
    ownerId: v.string(),
    updateAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
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
    analysisError: v.optional(v.string()),
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

  userProfiles: defineTable({
    ownerId: v.string(),
    onboardingCompletedAt: v.optional(v.number()),
    state: v.optional(v.string()),
    ageRange: v.optional(v.string()),
    workType: v.optional(v.string()),
    annualHouseholdIncome: v.optional(v.number()),
    discoveryStatus: v.union(
      v.literal("idle"),
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    discoveryError: v.optional(v.string()),
    lastDiscoveryAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  dashboardSchemes: defineTable({
    ownerId: v.string(),
    schemeKey: v.string(),
    rank: v.number(),
    title: v.string(),
    imageUrl: v.optional(v.string()),
    websiteUrl: v.string(),
    description: v.string(),
    deleteAfter: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_scheme", ["ownerId", "schemeKey"])
    .index("by_owner_rank", ["ownerId", "rank"])
    .index("by_delete_after", ["deleteAfter"]),
})
