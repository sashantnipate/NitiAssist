import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GetStepTools } from "inngest";
import { inngest } from "../../../inngest/client";
import { createReadUrl } from "../../../lib/r2";
import { model } from "./model";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
type StepTools = GetStepTools<typeof inngest>;
type AiInferBody = Parameters<StepTools["ai"]["infer"]>[1]["body"];

export async function getImageDescriptions(
  conversationId: Id<"conversations">,
  documentIds: Id<"documents">[],
  step: StepTools,
) {
  if (documentIds.length === 0) return [];

  const documents = await step.run("load-attached-images", () =>
    convex.query(api.documents.getForAgent, { conversationId, documentIds, serviceSecret: process.env.INNGEST_CONVEX_SECRET! }),
  );

  return await Promise.all(documents.map(async (document) => {
    if (document.status === "ready" && document.description) {
      return { filename: document.filename, description: document.description };
    }

    try {
      const imageUrl = await step.run(`create-image-url-${document._id}`, () =>
        createReadUrl(document.objectKey),
      );
      const response = await step.ai.infer(`describe-image-${document._id}`, {
        model,
        body: {
          messages: [{
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image accurately and concretely for later use in a conversation. Include visible text, important objects, people, relationships, and relevant details. Do not guess at facts that are not visible.",
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          }],
          max_completion_tokens: 500,
        } as AiInferBody,
      });
      const result = response.choices[0]?.message.content;
      const description = result?.trim() ?? "";
      if (!description) throw new Error("Image description was empty.");
      await step.run(`save-image-description-${document._id}`, () =>
        convex.mutation(api.documents.saveDescription, {
          documentId: document._id,
          description,
          status: "ready",
          serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
        }),
      );
      return { filename: document.filename, description };
    } catch (error) {
      await step.run(`mark-image-failed-${document._id}`, () =>
        convex.mutation(api.documents.saveDescription, {
          documentId: document._id,
          description: "",
          status: "failed",
          serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
        }),
      );
      throw error;
    }
  }));
}
