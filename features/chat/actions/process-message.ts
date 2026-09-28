"use server";

import { inngest } from "@/inngest/client";
import type { Id } from "@/convex/_generated/dataModel";

type TriggerAgentArgs = {
  prompt: string;
  assistantMessageId: Id<"messages">;
  conversationId: Id<"conversations">;
};

export async function triggerChatAgent({
  prompt,
  assistantMessageId,
  conversationId,
}: TriggerAgentArgs) {
  await inngest.send({
    name: "chat/message.created",
    data: {
      prompt,
      assistantMessageId,
      conversationId,
    },
  });

  return { success: true };
}