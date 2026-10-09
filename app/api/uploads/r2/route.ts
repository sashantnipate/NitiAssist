import { auth } from "@clerk/nextjs/server";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createReadUrl, createUploadUrl, deleteR2Object } from "@/lib/r2";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as {
      operation?: string;
      filename?: string;
      mimeType?: string;
      size?: number;
      objectKey?: string;
    };

    if (body.operation === "upload") {
      if (!body.filename?.trim() || !body.mimeType || !body.size || !ALLOWED_IMAGE_TYPES.has(body.mimeType)) {
        return NextResponse.json({ error: "Unsupported image type or size" }, { status: 400 });
      }
      if (!Number.isInteger(body.size) || body.size <= 0 || body.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 413 });
      }
      const objectKey = `${userId}/${randomUUID()}`;
      const uploadUrl = await createUploadUrl(objectKey, body.mimeType, body.size);
      return NextResponse.json({ objectKey, uploadUrl });
    }

    if (body.operation === "read" || body.operation === "delete") {
      if (!body.objectKey || !body.objectKey.startsWith(`${userId}/`)) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 });
      }
      if (body.operation === "delete") {
        await deleteR2Object(body.objectKey);
        return NextResponse.json({ success: true });
      }
      const readUrl = await createReadUrl(body.objectKey);
      return NextResponse.json({ readUrl });
    }

    return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
  } catch (error) {
    console.error("R2 upload route failed", error);
    return NextResponse.json({ error: "Image storage request failed" }, { status: 500 });
  }
}
