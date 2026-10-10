import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { verifyAuth } from "./verifyAuth"

const schemeValidator = v.object({
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
})

function validateUrls(urls: string[]) {
  for (const value of urls) {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("Scheme links must use HTTP or HTTPS")
  }
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx)
    return await ctx.db
      .query("userSchemes")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .collect()
  },
})

export const getMine = query({
  args: { schemeId: v.id("userSchemes") },
  handler: async (ctx, { schemeId }) => {
    const identity = await verifyAuth(ctx)
    const scheme = await ctx.db.get(schemeId)
    if (!scheme || scheme.ownerId !== identity.subject) return null
    return scheme
  },
})

export const startDiscovery = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx)
    const now = Date.now()
    return await ctx.db.insert("schemeDiscoveryJobs", {
      ownerId: identity.subject,
      status: "queued",
      startedAt: now,
    })
  },
})

export const latestDiscovery = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx)
    return await ctx.db
      .query("schemeDiscoveryJobs")
      .withIndex("by_owner_started", (q) => q.eq("ownerId", identity.subject))
      .order("desc")
      .first()
  },
})

export const persistDiscoveryResults = mutation({
  args: {
    discoveryJobId: v.id("schemeDiscoveryJobs"),
    schemes: v.array(schemeValidator),
    serviceSecret: v.string(),
  },
  handler: async (ctx, { discoveryJobId, schemes, serviceSecret }) => {
    if (
      !process.env.INNGEST_CONVEX_SECRET ||
      serviceSecret !== process.env.INNGEST_CONVEX_SECRET
    )
      throw new Error("Unauthorized service request")
    const job = await ctx.db.get(discoveryJobId)
    if (!job) throw new Error("Discovery job not found")
    if (job.status !== "running" && job.status !== "queued")
      throw new Error("Discovery job is no longer active")
    const now = Date.now()
    for (const scheme of schemes) {
      const schemeKey = scheme.schemeKey.trim()
      if (!schemeKey || !scheme.title.trim())
        throw new Error("Scheme key and title are required")
      validateUrls(scheme.sourceUrls)
      if (scheme.applicationUrl) validateUrls([scheme.applicationUrl])
      const existing = await ctx.db
        .query("userSchemes")
        .withIndex("by_owner_scheme_key", (q) =>
          q.eq("ownerId", job.ownerId).eq("schemeKey", schemeKey)
        )
        .unique()
      const values = {
        ...scheme,
        schemeKey,
        title: scheme.title.trim(),
        ownerId: job.ownerId,
        updatedAt: now,
      }
      if (existing) await ctx.db.patch(existing._id, values)
      else await ctx.db.insert("userSchemes", { ...values, createdAt: now })
    }
    await ctx.db.patch(discoveryJobId, {
      status: "running",
      ...(job.status === "queued" ? { startedAt: now } : {}),
    })
    return { savedCount: schemes.length }
  },
})

export const updateDiscoveryStatus = mutation({
  args: {
    discoveryJobId: v.id("schemeDiscoveryJobs"),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultCount: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    if (
      !process.env.INNGEST_CONVEX_SECRET ||
      args.serviceSecret !== process.env.INNGEST_CONVEX_SECRET
    )
      throw new Error("Unauthorized service request")
    const job = await ctx.db.get(args.discoveryJobId)
    if (!job) throw new Error("Discovery job not found")
    if (
      (job.status === "completed" || job.status === "failed") &&
      args.status !== job.status
    ) {
      throw new Error("Discovery job is already complete")
    }
    const completedAt =
      args.status === "completed" || args.status === "failed"
        ? Date.now()
        : undefined
    await ctx.db.patch(args.discoveryJobId, {
      status: args.status,
      ...(args.resultCount !== undefined
        ? { resultCount: args.resultCount }
        : {}),
      ...(args.errorMessage
        ? { errorMessage: args.errorMessage.slice(0, 1000) }
        : { errorMessage: undefined }),
      ...(completedAt ? { completedAt } : {}),
    })
  },
})

const demoSchemes = [
  {
    schemeKey: "demo:nitiassist:scholarship",
    title: "Demo: Student Achievement Scholarship",
    department: "Illustrative education department",
    category: "Scholarship",
    description:
      "Demo data — not verified. A synthetic scholarship example for previewing the dashboard layout.",
    benefitDetails:
      "Illustrative benefit: ₹25,000 per academic year. Demo only; no real award is offered.",
    eligibility: [
      "Illustrative student eligibility placeholder — not verified.",
    ],
    requiredDocuments: ["Demo identity document placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Illustrative deadline — demo only",
    applicationStatus: "open" as const,
    sourceUrls: [],
  },
  {
    schemeKey: "demo:nitiassist:business-subsidy",
    title: "Demo: Small Business Modernization Subsidy",
    department: "Illustrative enterprise department",
    category: "Subsidy",
    description:
      "Demo data — not verified. Synthetic example of a small business upgrade subsidy.",
    benefitDetails:
      "Illustrative benefit: up to ₹1,00,000. Demo only; not a government benefit.",
    eligibility: [
      "Illustrative small business eligibility placeholder — not verified.",
    ],
    requiredDocuments: ["Demo business registration placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Illustrative deadline — demo only",
    applicationStatus: "open" as const,
    sourceUrls: [],
  },
  {
    schemeKey: "demo:nitiassist:education-assistance",
    title: "Demo: Continuing Education Assistance",
    department: "Illustrative learning department",
    category: "Other",
    description:
      "Demo data — not verified. Synthetic education assistance record for showing longer card descriptions.",
    benefitDetails:
      "Illustrative benefit: ₹8,000 toward course materials. Demo only.",
    eligibility: ["Illustrative learner criteria placeholder — not verified."],
    requiredDocuments: ["Demo enrollment proof placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Not specified — demo data",
    applicationStatus: "unknown" as const,
    sourceUrls: [],
  },
  {
    schemeKey: "demo:nitiassist:agriculture-assistance",
    title: "Demo: Farm Equipment Assistance",
    department: "Illustrative agriculture department",
    category: "Grant",
    description:
      "Demo data — not verified. Synthetic agriculture assistance example with no verified program rules.",
    benefitDetails:
      "Illustrative benefit: 30% equipment cost support. Demo only; not verified.",
    eligibility: ["Illustrative farmer criteria placeholder — not verified."],
    requiredDocuments: ["Demo land record placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Illustrative deadline — demo only",
    applicationStatus: "closed" as const,
    sourceUrls: [],
  },
  {
    schemeKey: "demo:nitiassist:business-credit",
    title: "Demo: Small Enterprise Credit Support",
    department: "Illustrative enterprise finance department",
    category: "Business",
    description:
      "Demo data — not verified. Synthetic example of a business credit support listing.",
    benefitDetails:
      "Illustrative benefit: credit support up to ₹5,00,000. Demo only; no lender is associated.",
    eligibility: [
      "Illustrative enterprise criteria placeholder — not verified.",
    ],
    requiredDocuments: ["Demo business plan placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Not specified — demo data",
    applicationStatus: "unknown" as const,
    sourceUrls: [],
  },
  {
    schemeKey: "demo:nitiassist:tax-benefit",
    title: "Demo: Green Equipment Tax Benefit",
    department: "Illustrative tax department",
    category: "Tax Benefit",
    description:
      "Demo data — not verified. Synthetic tax benefit example; it does not describe actual tax rules.",
    benefitDetails:
      "Illustrative benefit: 10% deduction example. Demo only; not tax advice.",
    eligibility: ["Illustrative taxpayer criteria placeholder — not verified."],
    requiredDocuments: ["Demo purchase record placeholder"],
    applicationSteps: ["Demo application step — no real application exists."],
    deadlineText: "Not specified — demo data",
    applicationStatus: "unknown" as const,
    sourceUrls: [],
  },
]

function requireDevelopmentSeedEnabled() {
  if (process.env.SCHEME_DEMO_SEED_ENABLED !== "true") {
    throw new Error(
      "Scheme demo data is disabled unless explicitly enabled on a development Convex deployment"
    )
  }
}

export const seedDevelopmentDemo = mutation({
  args: {},
  handler: async (ctx) => {
    requireDevelopmentSeedEnabled()
    const identity = await verifyAuth(ctx)
    const existing = await ctx.db
      .query("userSchemes")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect()
    if (
      existing.some(
        (scheme) => !scheme.schemeKey.startsWith("demo:nitiassist:")
      )
    ) {
      return {
        seeded: false,
        reason: "Existing saved schemes were left unchanged",
        count: existing.length,
      }
    }
    const existingKeys = new Set(existing.map((scheme) => scheme.schemeKey))
    const now = Date.now()
    let added = 0
    for (const scheme of demoSchemes) {
      if (existingKeys.has(scheme.schemeKey)) continue
      await ctx.db.insert("userSchemes", {
        ...scheme,
        ownerId: identity.subject,
        createdAt: now,
        updatedAt: now,
      })
      added++
    }
    return { seeded: true, added, count: existing.length + added }
  },
})

export const removeDevelopmentDemo = mutation({
  args: {},
  handler: async (ctx) => {
    requireDevelopmentSeedEnabled()
    const identity = await verifyAuth(ctx)
    const existing = await ctx.db
      .query("userSchemes")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect()
    const demos = existing.filter((scheme) =>
      scheme.schemeKey.startsWith("demo:nitiassist:")
    )
    for (const scheme of demos) await ctx.db.delete(scheme._id)
    return { removed: demos.length }
  },
})
