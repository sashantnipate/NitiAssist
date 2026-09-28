import { createTool } from "@inngest/agent-kit";
import { Firecrawl } from "firecrawl";
import { z } from "zod";

const firecrawl = new Firecrawl({
  apiKey: process.env.FIRECRAWL_API_KEY,
});

export const firecrawlScrapeTool = createTool({
  name: "web_scrape",

  description:
    "Read a specific webpage in detail. Use this when a search result contains useful government or policy information that needs to be inspected before answering.",

  parameters: z.object({
    url: z
      .string()
      .describe(
        "Full URL of the webpage to read."
      ),
  }),

  handler: async ({ url }) => {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error(
        "FIRECRAWL_API_KEY is not configured."
      );
    }

    try {
      const parsedUrl = new URL(url);

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        throw new Error(
          "URL must use HTTP or HTTPS."
        );
      }

      const page = await firecrawl.scrape(
        url,
        {
          formats: ["markdown"],
          onlyMainContent: true,
        }
      );

      return {
        success: true,
        url,
        title: page.metadata?.title ?? "",
        description: page.metadata?.description ?? "",
        markdown: page.markdown ?? "",
      };
    } catch (error) {

      throw new Error(
        error instanceof Error
          ? `Web scraping failed: ${error.message}`
          : "Web scraping failed."
      );
    }
  },
});