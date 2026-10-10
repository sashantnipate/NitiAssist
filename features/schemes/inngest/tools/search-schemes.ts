import { Firecrawl } from "firecrawl";
import type { UserContext } from "./get-user-context";

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });

export type SchemeSearchResult = {
  title: string;
  url: string;
  description: string;
};

export type SchemeImageResult = {
  url: string;
  imageUrl: string;
};

type StepRunner = {
  run(name: string, fn: () => Promise<unknown>): Promise<unknown>;
};

function incomeRange(income?: number) {
  if (income === undefined) return "household income eligibility";
  if (income < 100_000) return "annual household income below INR 1 lakh";
  if (income < 250_000) return "annual household income INR 1-2.5 lakh";
  if (income < 500_000) return "annual household income INR 2.5-5 lakh";
  if (income < 800_000) return "annual household income INR 5-8 lakh";
  return "annual household income above INR 8 lakh";
}

function documentFacts(context: UserContext) {
  return context.documents.flatMap(({ description }) => description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^(category|caste|occupation|work type|disability|landholding|ration card|minority|widow|farmer|student)\s*:/i.test(line))
    .map((line) => line.slice(0, 100)))
    .filter((fact, index, facts) => facts.indexOf(fact) === index)
    .slice(0, 10);
}

function makeSearchQuery(context: UserContext) {
  const { profile } = context;
  const facts = documentFacts(context);
  const state = profile.state ?? "India";
  const applicant = [profile.ageRange, profile.workType].filter(Boolean).join(" ") || "households";
  const documentEligibility = facts.length ? facts.join(", ") : applicant;
  const query = `${state} India government welfare schemes for ${applicant}, ${incomeRange(profile.annualHouseholdIncome)}, ${documentEligibility}; current eligibility benefits official government schemes`;
  return query.slice(0, 500);
}

function officialUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || !(host === "gov.in" || host.endsWith(".gov.in") || host === "nic.in" || host.endsWith(".nic.in"))) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export async function searchSchemes({ context, step }: { context: UserContext; step: StepRunner }) {
  if (!process.env.FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured.");
  const query = makeSearchQuery(context);
  return step.run("firecrawl-search-schemes", async () => {
    const response = await firecrawl.search(query, {
      limit: 20,
      country: "IN",
      timeout: 20_000,
      sources: ["web", "images"],
    });

    const resultsByUrl = new Map<string, SchemeSearchResult>();
    for (const page of response.web ?? []) {
      const url = "url" in page && typeof page.url === "string" ? officialUrl(page.url) : null;
      if (!url) continue;
      resultsByUrl.set(url, {
        title: ("title" in page && typeof page.title === "string" ? page.title : "").slice(0, 200),
        url,
        description: ("description" in page && typeof page.description === "string" ? page.description : "").slice(0, 800),
      });
    }

    const officialUrls = new Set(resultsByUrl.keys());
    const imagesBySource = new Map<string, SchemeImageResult>();
    for (const image of response.images ?? []) {
      const source = "url" in image && typeof image.url === "string" ? image.url : "";
      const imageValue = "imageUrl" in image && typeof image.imageUrl === "string" ? image.imageUrl : "";
      if (!source || !imageValue) continue;
      const sourceUrl = officialUrl(source);
      if (!sourceUrl || !officialUrls.has(sourceUrl)) continue;
      try {
        const imageUrl = new URL(imageValue);
        if (imageUrl.protocol !== "https:" && imageUrl.protocol !== "http:") continue;
        imagesBySource.set(sourceUrl, { url: sourceUrl, imageUrl: imageUrl.toString() });
      } catch {
        // Ignore malformed image URLs from search results.
      }
    }

    return {
      query,
      results: [...resultsByUrl.values()],
      images: [...imagesBySource.values()],
    };
  }) as Promise<{ query: string; results: SchemeSearchResult[]; images: SchemeImageResult[] }>;
}
