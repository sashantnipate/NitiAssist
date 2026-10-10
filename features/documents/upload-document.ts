import type { Id } from "@/convex/_generated/dataModel";
import { triggerDocumentAnalysis } from "./actions/trigger-analysis";

export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_DOCUMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

type RegisterArgs = {
  objectKey: string;
  filename: string;
  mimeType: string;
  size: number;
};

export async function uploadDocumentToLibrary(
  file: File,
  register: (args: RegisterArgs) => Promise<Id<"documents">>,
  markFailed: (args: { documentId: Id<"documents"> }) => Promise<unknown>,
) {
  if (!ACCEPTED_DOCUMENT_TYPES.has(file.type)) throw new Error("Choose an image or PDF document.");
  if (file.size <= 0 || file.size > MAX_DOCUMENT_SIZE) throw new Error("Documents must be 10 MB or smaller.");

  let signedResponse: Response;
  try {
    signedResponse = await fetch("/api/uploads/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "upload", filename: file.name, mimeType: file.type, size: file.size }),
    });
  } catch {
    throw new Error("Could not reach the app server to prepare the upload. Check your connection and retry.");
  }
  let signed: { objectKey?: string; uploadUrl?: string; error?: string };
  try {
    signed = await signedResponse.json() as typeof signed;
  } catch {
    throw new Error(`The app server returned an invalid response while preparing ${file.name}.`);
  }
  if (!signedResponse.ok || !signed.objectKey || !signed.uploadUrl) {
    throw new Error(signed.error ?? "Could not prepare the document upload.");
  }

  let putResponse: Response;
  try {
    putResponse = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new Error(`Could not reach Cloudflare R2 while uploading ${file.name}. If this is a browser CORS error, allow this app's exact origin, PUT, and Content-Type in the R2 bucket CORS policy.`);
  }
  if (!putResponse.ok) throw new Error(`Cloudflare R2 rejected the upload (HTTP ${putResponse.status}).`);

  let documentId: Id<"documents">;
  try {
    documentId = await register({
      objectKey: signed.objectKey,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    await fetch("/api/uploads/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "delete", objectKey: signed.objectKey }),
    }).catch(() => undefined);
    throw error;
  }

  try {
    await triggerDocumentAnalysis(documentId);
  } catch (error) {
    await markFailed({ documentId });
    throw new Error(error instanceof Error ? `Uploaded, but analysis could not start: ${error.message}` : "Uploaded, but analysis could not start.");
  }

  return documentId;
}
