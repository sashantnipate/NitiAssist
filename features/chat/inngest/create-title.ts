import { createAgent } from "@inngest/agent-kit"
import { ConvexHttpClient } from "convex/browser"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { inngest } from "../../../inngest/client"
import { getConvexServiceSecret } from "./convex-secret"
import { model } from "./model"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const conversationTitleAgent = createAgent({
  name: "Conversation Title Agent",
  description: "Creates a concise title for a conversation.",
  system:
    "Create a concise conversation title from the user's message. Return only the title, using at most 6 words and no quotation marks.",
  model,
})

export const createConversationTitle = inngest.createFunction(
  {
    id: "create-conversation-title",
    triggers: [{ event: "chat/title.requested" }],
  },
  async ({ event, step }) => {
    const { prompt, conversationId, userId } = event.data as {
      prompt: string
      conversationId: string
      userId: string
    }

    const result = await conversationTitleAgent.run(prompt.slice(0, 4000))
    const text = result.output.find(
      (message) => message.role === "assistant" && message.type === "text",
    )
    const content = text && "content" in text ? text.content : ""
    const generatedTitle = typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part) =>
              typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
                ? part.text
                : "",
            )
            .join("")
        : ""
    const title = generatedTitle
      .trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 60)
      .trim()

    if (!title) throw new Error("Conversation title was empty.")
    const serviceSecret = getConvexServiceSecret()

    await step.run("save-conversation-title", () =>
      convex.mutation(api.conversations.setTitleFromAgent, {
        conversationId: conversationId as Id<"conversations">,
        title,
        userId,
        serviceSecret,
      }),
    )

    return { success: true }
  },
)
