import {
  createAgent,
  createNetwork,
} from "@inngest/agent-kit"

import { ConvexHttpClient } from "convex/browser"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

import { inngest } from "../../../inngest/client"

import { firecrawlSearchTool, firecrawlScrapeTool } from "./tools"
import { FINANCIAL_POLICY_ASSISTANT_PROMPT } from "./constants"
import { getImageDescriptions } from "./analyze-images"
import { model } from "./model"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const financialPolicyAssistantAgent = createAgent({
  name: "Financial Policy Assistant Agent",

  description:
    "Extracts user details, researches current government policies and schemes, evaluates eligibility with rule-level citations, estimates benefits, and guides through application steps.",

  system: FINANCIAL_POLICY_ASSISTANT_PROMPT,

  model,

  tools: [firecrawlSearchTool, firecrawlScrapeTool],
})

// Single-agent network orchestrator with custom router to bypass default select_agent schema creation
const network = createNetwork({
  name: "Financial Policy Assistant Network",

  agents: [financialPolicyAssistantAgent],

  defaultModel: model,

  router: ({ callCount, lastResult }) => {
    if (callCount >= 5) {
      return
    }

    if (callCount > 0 && (!lastResult?.toolCalls || lastResult.toolCalls.length === 0)) {
      return
    }

    return financialPolicyAssistantAgent
  },

  maxIter: 5,
})

export const processChatMessage = inngest.createFunction(
  {
    id: "process-chat-message",

    cancelOn: [
      {
        event: "chat/message.cancelled",
        if: "async.data.assistantMessageId == event.data.assistantMessageId",
      },
    ],

    triggers: [
      {
        event: "chat/message.created",
      },
    ],
  },

  async ({ event, step }) => {
    const {
      prompt,
      assistantMessageId,
      conversationId,
      conversationContext = [],
      documentIds = [],
    } = event.data as {
      prompt: string
      assistantMessageId: Id<"messages">
      conversationId: Id<"conversations">
      conversationContext?: Array<{
        role: "user" | "assistant"
        content: string
      }>
      documentIds?: Id<"documents">[]
    }

    const history = conversationContext
      .map(
        ({ role, content }) =>
          `${role === "user" ? "User" : "Assistant"}: ${content}`
      )
      .join("\n\n")

    const promptWithContext = history
      ? `Conversation history:\n${history}\n\nCurrent user request:\n${prompt}`
      : `Current user request:\n${prompt}`

    let finalAnswer = ""

    let status: "completed" | "cancelled" = "completed"

    try {
      const imageDescriptions = await getImageDescriptions(conversationId, documentIds, step)
      const imageContext = imageDescriptions.length
        ? `\n\nAttached image descriptions:\n${imageDescriptions.map(({ filename, description }) => `- ${filename}: ${description}`).join("\n")}`
        : ""
      const result = await network.run(`${promptWithContext}${imageContext}`)

      const messages = result.state.results
        .flatMap((networkResult) => networkResult.output)
        .reverse()

      const lastTextMessage = messages.find(
        (message) =>
          message.role === "assistant" &&
          (message.type === "text" || ("content" in message && message.content))
      )

      if (
        lastTextMessage &&
        "content" in lastTextMessage &&
        lastTextMessage.content
      ) {
        if (typeof lastTextMessage.content === "string") {
          finalAnswer = lastTextMessage.content
        } else if (Array.isArray(lastTextMessage.content)) {
          finalAnswer = lastTextMessage.content
            .map((item) => {
              if (typeof item === "string") {
                return item
              }

              if (typeof item === "object" && item !== null && "text" in item) {
                return String(item.text)
              }

              return ""
            })
            .join("")
        }
      }

      if (!finalAnswer.trim()) {
        finalAnswer = "No response generated."

        status = "cancelled"
      }
    } catch (error) {
      status = "cancelled"

      finalAnswer =
        error instanceof Error
          ? `Error processing request: ${error.message}`
          : "An unexpected error occurred while processing the request."
    }

    await step.run("update-convex-message", async () => {
      await convex.mutation(api.messages.updateAssistantMessage, {
        assistantMessageId,
        content: finalAnswer,
        status,
      })
    })

    return {
      success: status === "completed",
    }
  }
)

export const cancelChatMessage = inngest.createFunction(
  {
    id: "cancel-chat-message",

    triggers: [
      {
        event: "chat/message.cancelled",
      },
    ],
  },

  async ({ event, step }) => {
    const { assistantMessageId } = event.data as {
      assistantMessageId: Id<"messages">
    }

    await step.run("mark-message-cancelled", async () => {
      await convex.mutation(api.messages.updateAssistantMessage, {
        assistantMessageId,
        content: "Request cancelled.",
        status: "cancelled",
      })
    })

    return {
      success: true,
    }
  }
)
