# Onboarding and scheme discovery

## Onboarding

The signed-in user's `userProfiles` row stores their state, age range, work type, annual household income, onboarding completion time, and discovery status. The app redirects users without `onboardingCompletedAt` to `/user-onboard`.

The first checkpoint saves profile details. The second renders the document library with image/PDF upload support; it can be skipped. Uploaded files are stored in Cloudflare R2, registered in `documents`, and queued for Inngest content analysis. The analysis updates the document filename and description.

Completing or skipping the second checkpoint marks onboarding complete, triggers `schemes/discovery.requested`, and sends the user to `/dashboard`.

## Scheme discovery

The Inngest discovery workflow loads the profile and ready document names/descriptions using `INNGEST_CONVEX_SECRET`, then makes one Firecrawl search request for relevant central and state schemes. The formatter selects up to 20 results from official government/NIC pages and saves them through its `save_schemes` tool. It does not run another model or search step if the model makes no tool call, and it does not scrape individual pages.

Discovery helpers live in `features/schemes/inngest/tools/`: `get-user-context.ts` loads applicant data, `search-schemes.ts` builds and runs the single search, and `save-schemes.ts` validates and persists the formatted results. Image URLs are accepted only when the image search ties them to the same official result URL. Saved descriptions use labeled plain text lines for benefits, eligibility, documents, and application steps.

Successful discovery replaces the user's `dashboardSchemes` list atomically. A failed search preserves the previous results and records a failure status on `userProfiles`. Browser reads use `dashboardSchemes.listMine` and `dashboardSchemes.getMine`; both derive ownership from Clerk identity. Service writes require the Convex secret.

Each dashboard scheme has `schemeKey`, `title`, `websiteUrl`, `description`, optional `imageUrl`, and optional `deleteAfter`. A daily Convex cron removes schemes whose confirmed `deleteAfter` timestamp has passed.

Set `INNGEST_CONVEX_SECRET`, `NEXT_PUBLIC_CONVEX_URL`, `NITIASSIST_OPENAI_API_KEY`, and `FIRECRAWL_API_KEY` in the Next.js/Inngest runtime. Set the same `INNGEST_CONVEX_SECRET` in the Convex deployment. Keep secrets server-side.
