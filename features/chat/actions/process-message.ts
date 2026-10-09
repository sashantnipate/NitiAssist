"use server";

import { inngest } from "@/inngest/client";
import type { Id } from "@/convex/_generated/dataModel";

type TriggerAgentArgs = {
  prompt: string;
  assistantMessageId: Id<"messages">;
  conversationId: Id<"conversations">;
  documentIds?: Id<"documents">[];
  conversationContext?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

export async function triggerChatAgent({
  prompt,
  assistantMessageId,
  conversationId,
  documentIds = [],
  conversationContext = [],
}: TriggerAgentArgs) {
  await inngest.send({
    name: "chat/message.created",
    data: {
      prompt,
      assistantMessageId,
      conversationId,
      documentIds,
      conversationContext,
    },
  });

  return { success: true };
}

export async function cancelChatAgent({
  assistantMessageId,
}: {
  assistantMessageId: Id<"messages">;
}) {
  await inngest.send({
    name: "chat/message.cancelled",
    data: {
      assistantMessageId,
    },
  });

  return { success: true };
}
