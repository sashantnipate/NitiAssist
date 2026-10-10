import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { GetStepTools } from "inngest";
import { inngest } from "../../../inngest/client";
import { createReadUrl } from "../../../lib/r2";
import { getConvexServiceSecret } from "./convex-secret";
import { model } from "./model";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
type StepTools = GetStepTools<typeof inngest>;
type AiInferBody = Parameters<StepTools["ai"]["infer"]>[1]["body"];

function getImageFilename(aiFilename: string, uploadedFilename: string) {
  const extension = uploadedFilename.match(/\.[a-z0-9]{1,10}$/i)?.[0] ?? "";
  const basename = aiFilename
    .trim()
    .replace(/\.[a-z0-9]{1,10}$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .replace(/-$/g, "") || "miscellaneous";

  return `${basename}${extension}`;
}

function parseImageAnalysis(content: string) {
  const json = content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  const analysis = JSON.parse(json) as { filename?: unknown; description?: unknown };
  if (typeof analysis.description !== "string" || !analysis.description.trim()) {
    throw new Error("Image description was empty.");
  }

  return {
    filename: typeof analysis.filename === "string" && analysis.filename.trim()
      ? analysis.filename.trim()
      : "miscellaneous",
    description: analysis.description.trim(),
  };
}

export async function getImageDescriptions(
  conversationId: Id<"conversations">,
  documentIds: Id<"documents">[],
  step: StepTools,
) {
  if (documentIds.length === 0) return [];
  const serviceSecret = getConvexServiceSecret();

  const documents = await step.run("load-attached-images", () =>
    convex.query(api.documents.getForAgent, { conversationId, documentIds, serviceSecret }),
  );

  return await Promise.all(documents.map(async (document) => {
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
                text: 'Analyze this image for later use in a conversation. Return only a JSON object with exactly two string fields: "filename" and "description". Set filename to a short, descriptive, lowercase filename based on the visible image content, without a file extension (for example, "aadhaar-card" or "shop-invoice"). If you cannot confidently identify the image content, set filename to "miscellaneous". In description, accurately describe visible text, important objects, people, relationships, and relevant details. Do not guess at facts that are not visible.',
              },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          }],
          max_completion_tokens: 500,
        } as AiInferBody,
      });
      const result = response.choices[0]?.message.content;
      if (!result?.trim()) throw new Error("Image analysis was empty.");
      const { filename: aiFilename, description } = parseImageAnalysis(result);
      const filename = getImageFilename(aiFilename, document.filename);
      await step.run(`save-image-description-${document._id}`, () =>
        convex.mutation(api.documents.saveDescription, {
          documentId: document._id,
          description,
          filename,
          status: "ready",
          serviceSecret,
        }),
      );
      return { filename, description };
    } catch (error) {
      await step.run(`mark-image-failed-${document._id}`, () =>
        convex.mutation(api.documents.saveDescription, {
          documentId: document._id,
          description: "",
          status: "failed",
          serviceSecret,
        }),
      );
      throw error;
    }
  }));
}
