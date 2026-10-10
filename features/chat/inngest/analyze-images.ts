import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import type { GetStepTools } from "inngest";
import type { Id, Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { inngest } from "../../../inngest/client";
import { createReadUrl } from "../../../lib/r2";
import { getConvexServiceSecret } from "./convex-secret";
import { model } from "./model";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
type StepTools = GetStepTools<typeof inngest>;
type AiInferBody = Parameters<StepTools["ai"]["infer"]>[1]["body"];

const analysisPrompt = `Read this document for later use by an assistant helping the document owner find Indian government schemes. Return only JSON with exactly two string fields: "filename" and "description". Set filename to a short, descriptive, lowercase name for the document type, without an extension (for example, "income-certificate" or "ration-card"). If you cannot identify it, use "miscellaneous".

The description must contain the actual legible information and field values from the document, not a summary of what kind of document it is. Use concise labeled lines, for example: "Name: ...\\nDate of birth: ...\\nState: ...\\nAnnual income: ...\\nOccupation: ...\\nCertificate issued: ...\\nValid through: ...". Extract all readable facts that may help assess scheme eligibility, such as the person's name, age or date of birth, location, household income, occupation, category, disability status, landholding, and certificate issue or expiry dates. Include other legible fields when relevant. Preserve names, dates, amounts, and categories as written. Do not guess, infer, or fill missing values. Omit unreadable or absent fields. Mask full Aadhaar, PAN, bank-account, and other sensitive identifier numbers; never include a complete number. If the document has no readable personal or eligibility information, say so plainly in the description.`;

function withDocumentExtension(aiFilename: string, document: Pick<Doc<"documents">, "filename" | "mimeType">) {
  const existingExtension = document.filename.match(/\.[a-z0-9]{1,10}$/i)?.[0];
  const extension = existingExtension ?? (document.mimeType === "application/pdf" ? ".pdf" : ".jpg");
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

function parseDocumentAnalysis(content: string) {
  const json = content.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "");
  const result = JSON.parse(json) as { filename?: unknown; description?: unknown };
  if (typeof result.description !== "string" || !result.description.trim()) {
    throw new Error("Document description was empty.");
  }
  return {
    filename: typeof result.filename === "string" && result.filename.trim() ? result.filename.trim() : "miscellaneous",
    description: result.description.trim(),
  };
}

async function analyzeDocument(document: Doc<"documents">, ownerId: string, step: StepTools) {
  if (document.status === "ready" && document.description) {
    return { filename: document.filename, description: document.description };
  }

  try {
    const readUrl = await step.run(`create-document-url-${document._id}`, () => createReadUrl(document.objectKey));
    let resultText: string | undefined;

    if (document.mimeType === "application/pdf") {
      resultText = await step.run(`analyze-pdf-${document._id}`, async () => {
        const apiKey = process.env.NITIASSIST_OPENAI_API_KEY;
        if (!apiKey) throw new Error("NITIASSIST_OPENAI_API_KEY is not configured.");
        const client = new OpenAI({ apiKey });
        const response = await client.responses.create({
          model: "gpt-4o-mini",
          input: [{
            role: "user",
            content: [
              { type: "input_text", text: analysisPrompt },
              { type: "input_file", file_url: readUrl },
            ],
          }],
          max_output_tokens: 1800,
        });
        return response.output_text;
      });
    } else {
      const response = await step.ai.infer(`describe-document-${document._id}`, {
        model,
        body: {
          messages: [{
            role: "user",
            content: [
              { type: "text", text: analysisPrompt },
              { type: "image_url", image_url: { url: readUrl, detail: "high" } },
            ],
          }],
          max_completion_tokens: 1800,
        } as AiInferBody,
      });
      resultText = response.choices[0]?.message.content ?? undefined;
    }

    if (!resultText?.trim()) throw new Error("Document analysis was empty.");
    const analysis = parseDocumentAnalysis(resultText);
    const filename = withDocumentExtension(analysis.filename, document);
    const serviceSecret = getConvexServiceSecret();
    await step.run(`save-document-description-${document._id}`, () =>
      convex.mutation(api.documents.saveDescription, {
        documentId: document._id,
        ownerId,
        description: analysis.description,
        filename,
        status: "ready",
        serviceSecret,
      }),
    );
    return { filename, description: analysis.description };
  } catch (error) {
    const analysisError = error instanceof Error ? error.message.slice(0, 500) : "Unknown document analysis error.";
    console.error(`Document analysis failed for ${document._id}:`, error);
    const serviceSecret = getConvexServiceSecret();
    await step.run(`mark-document-failed-${document._id}`, () =>
      convex.mutation(api.documents.saveDescription, {
        documentId: document._id,
        ownerId,
        description: "",
        analysisError,
        status: "failed",
        serviceSecret,
      }),
    );
    throw error;
  }
}

export async function getImageDescriptions(
  conversationId: Id<"conversations">,
  documentIds: Id<"documents">[],
  step: StepTools,
) {
  if (documentIds.length === 0) return [];
  const serviceSecret = getConvexServiceSecret();
  const documents = await step.run("load-attached-documents", () =>
    convex.query(api.documents.getForAgent, { conversationId, documentIds, serviceSecret }),
  );
  const conversation = await step.run("load-document-owner", async () => {
    const owner = documents[0]?.ownerId;
    if (!owner || documents.some((document) => document.ownerId !== owner)) {
      throw new Error("Attached documents do not belong to one user.");
    }
    return owner;
  });
  return await Promise.all(documents.map((document) => analyzeDocument(document, conversation, step)));
}

export async function analyzeOwnedDocument(
  ownerId: string,
  documentId: Id<"documents">,
  step: StepTools,
) {
  const serviceSecret = getConvexServiceSecret();
  const document = await step.run(`load-document-${documentId}`, () =>
    convex.query(api.documents.getForOwner, { ownerId, documentId, serviceSecret }),
  );
  return await analyzeDocument(document, ownerId, step);
}

export const analyzeUploadedDocument = inngest.createFunction(
  { id: "analyze-uploaded-document", triggers: [{ event: "documents/uploaded" }] },
  async ({ event, step }) => {
    const { ownerId, documentId } = event.data as { ownerId: string; documentId: Id<"documents"> };
    return await analyzeOwnedDocument(ownerId, documentId, step);
  },
);
