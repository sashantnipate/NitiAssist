import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import {
  cancelChatMessage,
  processChatMessage,
} from "@/features/chat/inngest/process-message";
import { createConversationTitle } from "@/features/chat/inngest/create-title";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processChatMessage, cancelChatMessage, createConversationTitle],
});
