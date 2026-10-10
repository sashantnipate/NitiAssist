import { createTool } from "@inngest/agent-kit";
import type { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type GetUserDocumentContextOptions = {
  convex: ConvexHttpClient;
  conversationId: Id<"conversations">;
  serviceSecret: string;
};

export function createGetUserDocumentContextTool({
  convex,
  conversationId,
  serviceSecret,
}: GetUserDocumentContextOptions) {
  return createTool({
    name: "get_user_document_context",
    description:
      "Load the user's saved document titles and extracted descriptions from their private Library. Call this before making personalized eligibility or scheme recommendations when the conversation does not already provide enough applicant details. Use only facts present in these descriptions. If no useful context is available, ask the user focused questions for the missing details.",
    parameters: z.object({}),
    handler: async () => {
      const documents = await convex.query(api.documents.listForAgent, {
        conversationId,
        serviceSecret,
      });
      const summarizedDocuments = documents.map((document) => ({
        title: document.filename,
        description: document.description.slice(0, 3000),
        mimeType: document.mimeType,
        status: document.status,
      }));
      const hasUsableContext = summarizedDocuments.some(
        (document) => document.status === "ready" && document.description.trim(),
      );

      return {
        hasUsableContext,
        documents: summarizedDocuments,
        instruction: hasUsableContext
          ? "Use the returned descriptions as applicant-provided evidence. Do not infer facts that are absent."
          : "There is no usable extracted document context. Ask focused questions to collect the essential applicant details before personalized eligibility research.",
      };
    },
  });
}
