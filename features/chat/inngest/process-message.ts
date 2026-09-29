import {
  createAgent,
  createNetwork,
  createTool,
  openai,
} from "@inngest/agent-kit"

import { z } from "zod"

import { ConvexHttpClient } from "convex/browser"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

import { inngest } from "../../../inngest/client"

import { firecrawlSearchTool, firecrawlScrapeTool } from "./tools"

import { CONVERSATION_AGENT_PROMPT, WEB_AGENT_PROMPT } from "./constants"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

const model = openai({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
})

const routeToAgentTool = createTool({
  name: "route_to_agent",

  description:
    "Route the current user request to the appropriate specialist agent.",

  parameters: z.object({
    agent: z
      .string()
      .describe("The exact name of the agent that should handle the request."),
  }),

  handler: async ({ agent }, { network }) => {
    if (!network) {
      throw new Error("Routing tool must run inside an AgentKit network.")
    }

    const selectedAgent = network.agents.get(agent)

    if (!selectedAgent) {
      throw new Error(`Agent "${agent}" does not exist in this network.`)
    }

    return selectedAgent.name
  },
})

const doneTool = createTool({
  name: "done",

  description:
    "Call this when the user's request has been completely handled and no additional agent should be executed.",

  handler: async () => {
    return "done"
  },
})

const conversationAgent = createAgent({
  name: "Conversation Agent",

  description:
    "Handles greetings, casual conversation, general questions, explanations, and applicant discussions that do not require current web research.",

  system: CONVERSATION_AGENT_PROMPT,

  model,

  tools: [routeToAgentTool, doneTool],
})

const webAgent = createAgent({
  name: "Financial Policy Web Agent",

  description:
    "Researches government subsidies, schemes, tax benefits, financial assistance, eligibility rules, required documents, benefit amounts, deadlines, and application procedures using current internet information.",

  system: WEB_AGENT_PROMPT,

  model,

  tools: [firecrawlSearchTool, firecrawlScrapeTool],
})

const finalAnswerAgent = createAgent({
  name: "Final Answer Agent",

  description:
    "Produces the final answer from the conversation and any research already completed.",

  system: `${WEB_AGENT_PROMPT}

This is the final response turn. Use the information already gathered in the
conversation and produce the best answer now. Do not call tools, route to
another agent, or say that more research is needed. If the research is
incomplete, clearly state the limitation and provide the most useful answer
supported by the available information.`,

  model,
})

const network = createNetwork({
  name: "Financial Policy Assistant",

  agents: [conversationAgent, webAgent, finalAnswerAgent],

  defaultModel: model,

  router: ({ callCount, lastResult, network }) => {
    if (callCount === 0) {
      return conversationAgent
    }

    // The fifth invocation must synthesize an answer instead of starting
    // another tool loop. This agent has no tools, so it must return text.
    if (callCount === 4) {
      return finalAnswerAgent
    }

    const tool = lastResult?.toolCalls.at(-1)

    if (!tool || tool.tool.name === "done") {
      return
    }

    if (
      tool.tool.name === "route_to_agent" &&
      typeof tool.content === "object" &&
      tool.content !== null &&
      "data" in tool.content &&
      typeof tool.content.data === "string"
    ) {
      const selectedAgent = network.agents.get(tool.content.data)

      if (!selectedAgent) {
        throw new Error(
          `Conversation agent selected unknown agent: ${tool.content.data}`
        )
      }

      return selectedAgent
    }

    if (
      lastResult?.agentName === webAgent.name &&
      (tool.tool.name === "web_search" || tool.tool.name === "web_scrape")
    ) {
      return webAgent
    }

    return
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
    } = event.data as {
      prompt: string
      assistantMessageId: Id<"messages">
      conversationId: Id<"conversations">
      conversationContext?: Array<{
        role: "user" | "assistant"
        content: string
      }>
    }

    void conversationId

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
      console.log("Starting financial policy network:", promptWithContext)

      const result = await network.run(promptWithContext)

      console.log("Network completed.")

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
      console.error("Financial Policy Network Error:", error)

      status = "cancelled"

      finalAnswer =
        error instanceof Error
          ? `OpenAI error: ${error.message}`
          : "Unknown error"
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
