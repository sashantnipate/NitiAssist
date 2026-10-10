import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

function assertServiceSecret(secret: string) {
  if (!process.env.INNGEST_CONVEX_SECRET || secret !== process.env.INNGEST_CONVEX_SECRET) {
    throw new Error("Unauthorized service request");
  }
}

export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .unique();
  },
});

export const saveOnboardingInfo = mutation({
  args: {
    state: v.string(),
    ageRange: v.string(),
    workType: v.string(),
    annualHouseholdIncome: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await verifyAuth(ctx);
    const state = args.state.trim();
    const ageRange = args.ageRange.trim();
    const workType = args.workType.trim();
    if (!state || !ageRange || !workType || !Number.isFinite(args.annualHouseholdIncome) || args.annualHouseholdIncome < 0) {
      throw new Error("Enter valid onboarding information.");
    }

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .unique();
    const now = Date.now();
    const values = { state, ageRange, workType, annualHouseholdIncome: args.annualHouseholdIncome, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, values);
      return existing._id;
    }
    return await ctx.db.insert("userProfiles", {
      ownerId: identity.subject,
      ...values,
      discoveryStatus: "idle",
      createdAt: now,
    });
  },
});

export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .unique();
    if (!profile) throw new Error("Save your profile information first.");

    const now = Date.now();
    await ctx.db.patch(profile._id, {
      onboardingCompletedAt: profile.onboardingCompletedAt ?? now,
      discoveryStatus: "queued",
      discoveryError: undefined,
      updatedAt: now,
    });
  },
});

export const getContextForDiscovery = query({
  args: { ownerId: v.string(), serviceSecret: v.string() },
  handler: async (ctx, { ownerId, serviceSecret }) => {
    assertServiceSecret(serviceSecret);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique();
    if (!profile?.onboardingCompletedAt) throw new Error("Onboarding is incomplete.");

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_owner_created", (q) => q.eq("ownerId", ownerId))
      .order("desc")
      .collect();
    const pendingDocumentCount = documents.filter((document) => document.status === "processing").length;

    return {
      profile: {
        state: profile.state,
        ageRange: profile.ageRange,
        workType: profile.workType,
        annualHouseholdIncome: profile.annualHouseholdIncome,
      },
      documents: documents
        .filter((document) => document.status === "ready")
        .map(({ _id, filename, description, mimeType }) => ({
          id: _id,
          filename,
          description: description ?? "",
          mimeType,
        })),
      pendingDocumentCount,
    };
  },
});

export const updateDiscoveryStatus = mutation({
  args: {
    ownerId: v.string(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (!profile) throw new Error("User profile not found.");
    const now = Date.now();
    await ctx.db.patch(profile._id, {
      discoveryStatus: args.status,
      discoveryError: args.error?.slice(0, 500),
      ...(args.status === "completed" ? { lastDiscoveryAt: now } : {}),
      updatedAt: now,
    });
  },
});
