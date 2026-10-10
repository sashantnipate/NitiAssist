import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { verifyAuth } from "./verifyAuth";

const schemeValidator = v.object({
  schemeKey: v.string(),
  title: v.string(),
  imageUrl: v.optional(v.string()),
  websiteUrl: v.string(),
  description: v.string(),
  deleteAfter: v.optional(v.number()),
});

function validateUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Scheme links must use HTTP or HTTPS.");
  }
}

function assertServiceSecret(secret: string) {
  if (!process.env.INNGEST_CONVEX_SECRET || secret !== process.env.INNGEST_CONVEX_SECRET) {
    throw new Error("Unauthorized service request");
  }
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);
    return await ctx.db
      .query("dashboardSchemes")
      .withIndex("by_owner_rank", (q) => q.eq("ownerId", identity.subject))
      .order("asc")
      .take(20);
  },
});

export const getMine = query({
  args: { schemeId: v.id("dashboardSchemes") },
  handler: async (ctx, { schemeId }) => {
    const identity = await verifyAuth(ctx);
    const scheme = await ctx.db.get(schemeId);
    return scheme?.ownerId === identity.subject ? scheme : null;
  },
});

export const bulkReplaceMine = mutation({
  args: {
    ownerId: v.string(),
    schemes: v.array(schemeValidator),
    serviceSecret: v.string(),
  },
  handler: async (ctx, args) => {
    assertServiceSecret(args.serviceSecret);
    if (args.schemes.length > 20) throw new Error("At most 20 schemes may be saved.");

    const deduplicated = new Map<string, (typeof args.schemes)[number]>();
    for (const scheme of args.schemes) {
      const schemeKey = scheme.schemeKey.trim();
      const title = scheme.title.trim();
      if (!schemeKey || !title) throw new Error("Scheme key and title are required.");
      validateUrl(scheme.websiteUrl);
      if (scheme.imageUrl) validateUrl(scheme.imageUrl);
      deduplicated.set(schemeKey, { ...scheme, schemeKey, title });
    }
    const schemes = [...deduplicated.values()].slice(0, 20);

    const existing = await ctx.db
      .query("dashboardSchemes")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .collect();
    for (const scheme of existing) await ctx.db.delete(scheme._id);

    const now = Date.now();
    for (const [rank, scheme] of schemes.entries()) {
      await ctx.db.insert("dashboardSchemes", {
        ...scheme,
        ownerId: args.ownerId,
        rank,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { savedCount: schemes.length };
  },
});

export const deleteExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("dashboardSchemes")
      .withIndex("by_delete_after", (q) => q.lt("deleteAfter", Date.now()))
      .collect();
    for (const scheme of expired) await ctx.db.delete(scheme._id);
    return { deletedCount: expired.length };
  },
});
