import { createAgent, openai } from "@inngest/agent-kit";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { inngest } from "../../../inngest/client";

const convex = new ConvexHttpClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

export const processChatMessage = inngest.createFunction(
  {
    id: "process-chat-message",
    triggers: [{ event: "chat/message.created" }],
  },

  async ({ event, step }) => {
    const { prompt, assistantMessageId } = event.data as {
      prompt: string;
      assistantMessageId: Id<"messages">;
      conversationId: Id<"conversations">;
    };

    let responseText = "";
    let status: "completed" | "cancelled" = "completed";

    try {

      const simpleAgent = createAgent({
        name: "Simple Conversation",
        system: "Answer users questions clearly and concisely.",
        model: openai({
          model: "gpt-4o-mini",
        }),
      });


      const result = await simpleAgent.run(prompt);

      console.log("AgentKit returned");

      const output = result.output;

      if (typeof output === "string") {
        responseText = output;
      } else if (Array.isArray(output)) {
        const lastItem = [...output].reverse().find(
          (item) =>
            typeof item === "string" ||
            ("content" in item && item.content)
        );

        if (typeof lastItem === "string") {
          responseText = lastItem;
        } else if (
          lastItem &&
          "content" in lastItem &&
          typeof lastItem.content === "string"
        ) {
          responseText = lastItem.content;
        } else {
          responseText = JSON.stringify(lastItem);
        }
      } else {
        responseText = JSON.stringify(output);
      }

      if (!responseText) {
        responseText = "No response generated.";
      }

    } catch (error) {
      console.error("Agent error:", error);

      status = "cancelled";

      responseText =
        error instanceof Error
          ? `OpenAI error: ${error.message}`
          : "Unknown error";
    }

    await step.run("update-convex-message", async () => {
      await convex.mutation(api.messages.updateAssistantMessage, {
        assistantMessageId,
        content: responseText,
        status,
      });
    });

    return {
      success: status === "completed",
    };
  }
);