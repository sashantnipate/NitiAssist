"use server";

import { auth } from "@clerk/nextjs/server";
import type { Id } from "@/convex/_generated/dataModel";
import { inngest } from "@/inngest/client";

export async function triggerDocumentAnalysis(documentId: Id<"documents">) {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in to upload documents.");

  await inngest.send({
    name: "documents/uploaded",
    data: { ownerId: userId, documentId },
  });
}
