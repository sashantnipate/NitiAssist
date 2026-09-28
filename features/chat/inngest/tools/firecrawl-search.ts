import { createTool } from "@inngest/agent-kit";
import { Firecrawl } from "firecrawl";
import { z } from "zod";

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export const firecrawlSearchTool = createTool({
  name: "web_search",

  description: `
Search the internet for government schemes, subsidies,
tax benefits, financial assistance, eligibility rules,
required documents, benefit amounts, and application
procedures.

Prefer official government and primary sources.
`,

  parameters: z.object({
    query: z
      .string()
      .min(1)
      .describe(
        "Search query for the financial policy or government scheme."
      ),

    limit: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe(
        "Maximum number of results to return."
      ),
  }),

  handler: async ({ query, limit }) => {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error(
        "FIRECRAWL_API_KEY is not configured."
      );
    }

    try {
      const response = await firecrawl.search(
        query,
        {
          limit,
        }
      );

      const results = (response.web ?? []).map(
        (result) => ({
          title:
            "title" in result
              ? result.title ?? ""
              : "",

          url:
            "url" in result
              ? result.url ?? ""
              : "",

          description:
            "description" in result
              ? result.description ?? ""
              : "",
        })
      );

      return {
        success: true,
        query,
        results,
      };
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Web search failed: ${error.message}`
          : "Web search failed."
      );
    }
  },
});