import { createTool } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../../../../convex/_generated/api";
import type { SchemeImageResult, SchemeSearchResult } from "./search-schemes";

const schemeInput = z.object({
  title: z.string().min(1).max(200).describe("Scheme name."),
  websiteUrl: z.string().max(2_048).describe("Official government or NIC page URL from the search results."),
  imageUrl: z.string().max(2_048).nullable().describe("Matching image URL from the image search results, or null."),
  summary: z.string().min(1).max(500).describe("Short plain-language summary of the scheme."),
  benefit: z.string().max(500).nullable().describe("Supported benefit details, or null if the source does not say."),
  eligibility: z.string().max(500).nullable().describe("Supported eligibility details, or null if the source does not say."),
  documents: z.array(z.string().max(120)).max(10).nullable().describe("Required documents supported by the source, or null if unspecified."),
  application: z.string().max(500).nullable().describe("How to apply, supported by the source, or null if unspecified."),
  deleteAfter: z.number().int().positive().nullable().describe("Unix timestamp in milliseconds for a clearly stated final deadline, or null."),
});

export type SchemeCandidate = z.infer<typeof schemeInput>;
type FormattedScheme = SchemeCandidate & { description: string };

type StepRunner = {
  run(name: string, fn: () => Promise<unknown>): Promise<unknown>;
};

type SaveSchemesOptions = {
  convex: ConvexHttpClient;
  ownerId: string;
  serviceSecret: string;
  step: StepRunner;
  sources: SchemeSearchResult[];
  images: SchemeImageResult[];
};

function canonicalOfficialUrl(value: string) {
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

export function createSaveSchemesTool({ convex, ownerId, serviceSecret, step, sources, images }: SaveSchemesOptions) {
  const sourceUrls = new Set(sources.map(({ url }) => canonicalOfficialUrl(url)).filter((url): url is string => Boolean(url)));
  const verifiedImages = new Map(images.flatMap(({ url, imageUrl }) => {
    const sourceUrl = canonicalOfficialUrl(url);
    if (!sourceUrl || !sourceUrls.has(sourceUrl)) return [];
    try {
      const parsed = new URL(imageUrl);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? [[sourceUrl, parsed.toString()] as const] : [];
    } catch {
      return [];
    }
  }));

  return createTool({
    name: "save_schemes",
    description: "Validate and save the final ranked scheme cards to the user's dashboard. Call once when the complete list is ready, including an empty list when there are no supported results.",
    parameters: z.object({ schemes: z.array(schemeInput).max(20) }),
    handler: async ({ schemes }) => {
      const deduplicated = new Map<string, FormattedScheme>();
      for (const scheme of schemes) {
        const websiteUrl = canonicalOfficialUrl(scheme.websiteUrl);
        if (!websiteUrl || !sourceUrls.has(websiteUrl) || deduplicated.has(websiteUrl)) continue;
        const description = [
          scheme.summary.trim(),
          scheme.benefit?.trim() ? `Benefit: ${scheme.benefit.trim()}` : "",
          scheme.eligibility?.trim() ? `Eligibility: ${scheme.eligibility.trim()}` : "",
          scheme.documents?.length ? `Documents: ${scheme.documents.map((document) => document.trim()).filter(Boolean).join(", ")}` : "",
          scheme.application?.trim() ? `How to apply: ${scheme.application.trim()}` : "",
        ].filter(Boolean).join("\n").slice(0, 2_000);
        if (!description) continue;
        const imageUrl = verifiedImages.get(websiteUrl);
        deduplicated.set(websiteUrl, {
          ...scheme,
          title: scheme.title.trim(),
          websiteUrl,
          description,
          ...(imageUrl ? { imageUrl } : {}),
        });
      }

      const normalized = [...deduplicated.entries()].slice(0, 20).map(([schemeKey, scheme]) => {
        const imageUrl = verifiedImages.get(schemeKey);
        return {
          schemeKey,
          title: scheme.title.trim(),
          websiteUrl: scheme.websiteUrl,
          description: scheme.description,
          ...(imageUrl ? { imageUrl } : {}),
          ...(scheme.deleteAfter ? { deleteAfter: scheme.deleteAfter } : {}),
        };
      });
      return step.run("save-schemes-to-dashboard", () => convex.mutation(api.dashboardSchemes.bulkReplaceMine, {
        ownerId,
        schemes: normalized,
        serviceSecret,
      }));
    },
  });
}
