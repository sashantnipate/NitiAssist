import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { createReadUrl } from "../../../lib/r2";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function getImageDescriptions(
  conversationId: Id<"conversations">,
  documentIds: Id<"documents">[],
  step: { run: <T>(name: string, handler: () => Promise<T>) => Promise<T> },
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
      const description = await step.run(`describe-image-${document._id}`, async () => {
        const imageUrl = await createReadUrl(document.objectKey);
        const response = await openai.responses.create({
          model: "gpt-4o-mini",
          input: [{
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Describe this image accurately and concretely for later use in a conversation. Include visible text, important objects, people, relationships, and relevant details. Do not guess at facts that are not visible.",
              },
              { type: "input_image", image_url: imageUrl, detail: "low" },
            ],
          }],
        });
        const result = response.output_text.trim();
        if (!result) throw new Error("Image description was empty.");
        await convex.mutation(api.documents.saveDescription, {
          documentId: document._id,
          description: result,
          status: "ready",
          serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
        });
        return result;
      });
      return { filename: document.filename, description };
    } catch (error) {
      await convex.mutation(api.documents.saveDescription, {
        documentId: document._id,
        description: "",
        status: "failed",
        serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
      });
      throw error;
    }
  }));
}
