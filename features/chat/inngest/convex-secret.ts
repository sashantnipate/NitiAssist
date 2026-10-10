export function getConvexServiceSecret() {
  const secret = process.env.INNGEST_CONVEX_SECRET;
  if (!secret) {
    throw new Error("INNGEST_CONVEX_SECRET is not configured.");
  }
  return secret;
}
