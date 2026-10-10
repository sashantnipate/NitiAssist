"use server"

import { auth } from "@clerk/nextjs/server"
import { inngest } from "@/inngest/client"
import type { Id } from "@/convex/_generated/dataModel"

export async function createConversationTitle(
  prompt: string,
  conversationId: Id<"conversations">,
) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to create a conversation title.")
  }

  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) return { success: true }

  try {
    await inngest.send({
      name: "chat/title.requested",
      data: {
        prompt: trimmedPrompt.slice(0, 4000),
        conversationId,
        userId,
      },
    })
  } catch {
    // The conversation already has a usable fallback title.
  }

  return { success: true }
}

