import {v} from "convex/values";
import { mutation, query } from "./_generated/server";


import { verifyAuth } from "./verifyAuth";

export const create = mutation({
    args:{
        title: v.string(),
        ownerId: v.string()
    },
    handler: async(ctx, args) =>{
        const identity = await verifyAuth(ctx);

        const conversationId = await ctx.db.insert("conversations",{
            title: args.title,
            ownerId: args.ownerId,
            updateAt: Date.now(),
        })

        return conversationId;
    },

})

export const getById = query({
    args:{
        id: v.id("conversations"),
    },
    handler: async(ctx, args) => {
        const identity = await verifyAuth(ctx);

        const conversations = await ctx.db.get("conversations", args.id);

        if(!conversations){
            throw new Error("Conversation Not Found");
        }

        return conversations;
    }
})

export const getByOwner = query({
  args: {},
  handler: async (ctx) => {
    const identity = await verifyAuth(ctx);

    return await ctx.db
      .query("conversations")
      .withIndex("by_owner", (q) =>
        q.eq("ownerId", identity.subject)
      )
      .order("desc")
      .collect();
  },
});