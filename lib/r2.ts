import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.R2_ACCOUNT_ID;
const bucketName = process.env.R2_BUCKET_NAME;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

function getClient() {
  if (!accountId || !bucketName || !accessKeyId || !secretAccessKey) {
    throw new Error("Cloudflare R2 is not configured.");
  }
  return {
    bucketName,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

function getExpirySeconds() {
  const configured = Number(process.env.R2_URL_EXPIRY_SECONDS ?? 300);
  if (!Number.isFinite(configured) || configured < 60 || configured > 3600) return 300;
  return configured;
}

export async function createUploadUrl(objectKey: string, mimeType: string, size: number) {
  const { client, bucketName } = getClient();
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: mimeType,
      ContentLength: size,
    }),
    { expiresIn: getExpirySeconds() },
  );
}

export async function createReadUrl(objectKey: string) {
  const { client, bucketName } = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucketName, Key: objectKey }),
    { expiresIn: getExpirySeconds() },
  );
}

export async function deleteR2Object(objectKey: string) {
  const { client, bucketName } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: objectKey }));
}
