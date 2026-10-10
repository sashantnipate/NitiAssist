"use server";

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getConvexServiceSecret } from "@/features/chat/inngest/convex-secret";
import { inngest } from "@/inngest/client";

export async function startSchemeDiscovery() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in before searching for schemes.");
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured.");

  const convex = new ConvexHttpClient(convexUrl);
  const serviceSecret = getConvexServiceSecret();
  await convex.query(api.userProfiles.getContextForDiscovery, { ownerId: userId, serviceSecret });
  await convex.mutation(api.userProfiles.updateDiscoveryStatus, {
    ownerId: userId,
    status: "queued",
    serviceSecret,
  });

  try {
    await inngest.send({ name: "schemes/discovery.requested", data: { ownerId: userId } });
  } catch (error) {
    await convex.mutation(api.userProfiles.updateDiscoveryStatus, {
      ownerId: userId,
      status: "failed",
      error: "Could not start scheme search. Please retry.",
      serviceSecret,
    });
    throw error;
  }
}
