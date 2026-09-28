import { serve } from "inngest/next";
import { inngest } from "../../../inngest/client";
import { processChatMessage } from "@/features/chat/inngest/process-message";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processChatMessage],
});