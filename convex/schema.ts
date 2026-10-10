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

  userSchemes: defineTable({
    ownerId: v.string(),
    schemeKey: v.string(),
    title: v.string(),
    department: v.optional(v.string()),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    benefitDetails: v.optional(v.string()),
    eligibility: v.optional(v.array(v.string())),
    requiredDocuments: v.optional(v.array(v.string())),
    applicationSteps: v.optional(v.array(v.string())),
    deadlineText: v.optional(v.string()),
    deadlineTimestamp: v.optional(v.number()),
    applicationStatus: v.optional(
      v.union(v.literal("open"), v.literal("closed"), v.literal("unknown"))
    ),
    applicationUrl: v.optional(v.string()),
    sourceUrls: v.array(v.string()),
    lastVerifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_owner_scheme_key", ["ownerId", "schemeKey"]),

  schemeDiscoveryJobs: defineTable({
    ownerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    resultCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  }).index("by_owner_started", ["ownerId", "startedAt"]),
})
