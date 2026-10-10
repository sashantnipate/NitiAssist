# Scheme discovery integration contract

The current chat workflow returns narrative assistant responses and Firecrawl tool output; it does not produce structured scheme records. The dashboard reads only records persisted by the dedicated discovery workflow. No profile lookup or search trigger is included here.

## Start and track a job

1. An authenticated client creates a job with useMutation(api.userSchemes.startDiscovery). This mutation derives ownerId from Clerk identity and returns a schemeDiscoveryJobs ID. Never pass a client supplied owner ID.
2. The trusted search workflow receives that job ID and calls api.userSchemes.updateDiscoveryStatus through the server side ConvexHttpClient, with serviceSecret from process.env.INNGEST_CONVEX_SECRET and status running.
3. On success, call api.userSchemes.persistDiscoveryResults with the job ID and structured results, then call updateDiscoveryStatus with completed and the result count. An empty successful search is completed with resultCount 0.
4. On an unsuccessful search, call updateDiscoveryStatus with failed and a user safe errorMessage. Do not leave a job running after a terminal error.

Browser queries are api.userSchemes.listMine, api.userSchemes.latestDiscovery, and api.userSchemes.getMine({ schemeId }). All derive ownership from Clerk. Scheme detail reads for another owner's ID return null.

## Result payload

Each entry in schemes uses this shape:

- Required: schemeKey (stable per government scheme), title, sourceUrls: string[].
- Optional text: department, category, description, benefitDetails, deadlineText, applicationUrl.
- Optional structured lists: eligibility: string[], requiredDocuments: string[], applicationSteps: string[].
- Optional normalized values: deadlineTimestamp: number (milliseconds only when unambiguous), applicationStatus: open | closed | unknown, lastVerifiedAt: number (milliseconds).

Only include source supported details. HTTP and HTTPS are required for application and source URLs. The mutation upserts on job ownerId plus schemeKey, so repeated results update that user's record without merging data across users. Convex enforces the payload shape and validates URLs.

## Server side call example

    await convex.mutation(api.userSchemes.updateDiscoveryStatus, {
      discoveryJobId, status: "running", serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
    });
    await convex.mutation(api.userSchemes.persistDiscoveryResults, {
      discoveryJobId, schemes, serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
    });
    await convex.mutation(api.userSchemes.updateDiscoveryStatus, {
      discoveryJobId, status: "completed", resultCount: schemes.length,
      serviceSecret: process.env.INNGEST_CONVEX_SECRET!,
    });

Configure INNGEST_CONVEX_SECRET in both the Next.js/Inngest runtime and Convex deployment. Keep it server side. The dashboard currently has no refresh action because no discovery trigger exists in this project; connect one to job creation before exposing retry to users.

## Local dashboard demo data

The dashboard exposes Load six demo schemes only in a Next.js development build. Convex requires SCHEME_DEMO_SEED_ENABLED=true for the seed and cleanup mutations. The flag is set per deployment; configure it only on the local Convex development deployment, for example with `npx convex env set SCHEME_DEMO_SEED_ENABLED true` while connected to the development deployment; do not set it on production. Restart `npx convex dev` if needed, then sign in and use the button on an empty dashboard. The mutation derives the owner from Clerk and refuses to seed over any non-demo scheme record. The six records use reserved `demo:nitiassist:` keys and explicitly say they are unverified. Click Remove demo data to delete only those records for the signed-in user. Re-running seed after deletion is safe.
