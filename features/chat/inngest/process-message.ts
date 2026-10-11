import {
  createAgent,
  createNetwork,
  createTool,
} from "@inngest/agent-kit"
import { z } from "zod"

import { ConvexHttpClient } from "convex/browser"

import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

import { inngest } from "../../../inngest/client"

import { createGetUserDocumentContextTool, firecrawlSearchTool, firecrawlScrapeTool } from "./tools"
import { FINANCIAL_POLICY_ASSISTANT_PROMPT } from "./constants"
import { getImageDescriptions } from "./analyze-images"
import { model } from "./model"
import { getConvexServiceSecret } from "./convex-secret"

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

type ClarifyingQuestion = {
  id: string
  type: "yes-no" | "single-choice" | "text"
  question: string
  options?: string[]
}

function createAskClarifyingQuestionsTool(
  onQuestions: (questions: ClarifyingQuestion[]) => void | Promise<void>
) {
  const tool = createTool({
    name: "ask_clarifying_questions",
    description:
      "Ask at most two relevant, essential follow-up questions in one round. Questions are also saved in the assistant message. Do not ask for details already in the conversation or user documents.",
    parameters: z.object({
      questions: z.array(z.object({
        id: z.string().optional(),
        type: z.enum(["yes-no", "single-choice", "text"]),
        question: z.string(),
        options: z.array(z.string()).optional(),
      })),
    }),
    handler: async ({ questions }) => {
      const validQuestions = questions.flatMap((item, index): ClarifyingQuestion[] => {
        const question = item.question.trim()
        const options = item.options?.filter((option) => option.trim()).map((option) => option.trim())
        if (!question || (item.type === "single-choice" && (!options || options.length < 2))) {
          return []
        }

        return [{
          id: item.id?.trim() || `clarification-${index + 1}`,
          type: item.type,
          question,
          ...(item.type === "single-choice" ? { options: options?.slice(0, 6) } : {}),
        }]
      }).slice(0, 2)
      if (validQuestions.length === 0) {
        return "No questions were displayed. Call this tool again with one or two valid, relevant questions if essential information is missing."
      }

      await onQuestions(validQuestions)
      return "The questions are displayed above the chat input and saved in the assistant message. Do not add other questions or repeat them in your reply."
    },
  })
  tool.strict = false
  return tool
}

function createSaveFinalResponseTool(
  onSave: (content: string) => void | Promise<void>
) {
  return createTool({
    name: "save_final_response",
    description:
      "Persist the completed response as the assistant's final message. Call this once after preparing the final answer.",
    parameters: z.object({ content: z.string() }),
    handler: async ({ content }) => {
      const response = content.trim()
      if (!response) return "The response was empty and was not saved. Provide a non-empty final response and try again."

      await onSave(response)
      return "The final response was saved to the conversation."
    },
  })
}

function createFinancialPolicyAssistantNetwork(
  conversationId: Id<"conversations">,
  onQuestions: (questions: ClarifyingQuestion[]) => void | Promise<void>,
  onFinalResponse: (content: string) => void | Promise<void>
) {
  let clarificationRequested = false
  let finalResponseSaved = false

  const financialPolicyAssistantAgent = createAgent({
    name: "Financial Policy Assistant Agent",
    description:
      "Extracts user details, researches current government policies and schemes, evaluates eligibility with rule-level citations, estimates benefits, and guides through application steps.",
    system: FINANCIAL_POLICY_ASSISTANT_PROMPT,
    model,
    tools: [
      createGetUserDocumentContextTool({
        convex,
        conversationId,
        serviceSecret: getConvexServiceSecret(),
      }),
      createAskClarifyingQuestionsTool((questions) => {
        clarificationRequested = true
        return onQuestions(questions)
      }),
      firecrawlSearchTool,
      firecrawlScrapeTool,
    ],
  })

  const finalResponseAgent = createAgent({
    name: "Final Response Agent",
    description:
      "Turns the research agent's findings into a concise answer and saves it to the conversation.",
    system: `You are NitiAssist's final response agent. Read the user's request and the preceding agent's findings, then write a concise, useful final answer.

- Base claims only on the conversation and preceding agent results. Preserve relevant source links and citations from research. Never invent scheme details or claim research that was not done.
- Do not ask clarification questions in this stage. Clarification is handled before you are selected; if information is still missing, state the limitation clearly.
- Use Markdown. Use a table when comparing multiple schemes.
- After composing the complete response, call save_final_response with the exact response text. Do not finish without saving it.`,
    model,
    tools: [
      createSaveFinalResponseTool(async (content) => {
        await onFinalResponse(content)
        finalResponseSaved = true
      }),
    ],
  })

  // Reserve the final network iteration for response synthesis and persistence.
  return createNetwork({
    name: "Financial Policy Assistant Network",
    agents: [financialPolicyAssistantAgent, finalResponseAgent],
    defaultModel: model,
    router: ({ callCount, lastResult }) => {
      if (clarificationRequested || finalResponseSaved) return
      if (callCount >= 4) return finalResponseAgent
      if (callCount > 0 && (!lastResult?.toolCalls || lastResult.toolCalls.length === 0)) {
        return finalResponseAgent
      }
      return financialPolicyAssistantAgent
    },
    maxIter: 5,
  })
}

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
    let questions: ClarifyingQuestion[] = []
    let finalResponseSaved = false

    let status: "completed" | "cancelled" = "completed"

    try {
      const imageDescriptions = await getImageDescriptions(conversationId, documentIds, step)
      const imageContext = imageDescriptions.length
        ? `\n\nAttached image descriptions:\n${imageDescriptions.map(({ filename, description }) => `- ${filename}: ${description}`).join("\n")}`
        : ""
      const network = createFinancialPolicyAssistantNetwork(
        conversationId,
        async (askedQuestions) => {
          questions = askedQuestions
          const questionMessage = [
            "To help me find the right options, please answer:",
            ...askedQuestions.map(({ question }, index) => `${index + 1}. ${question}`),
          ].join("\n")
          await convex.mutation(api.messages.updateAssistantMessage, {
            assistantMessageId,
            content: questionMessage,
            status: "processing",
            questions: askedQuestions,
          })
        },
        async (content) => {
          finalAnswer = content
          await convex.mutation(api.messages.updateAssistantMessage, {
            assistantMessageId,
            content,
            status: "completed",
            questions: [],
          })
          finalResponseSaved = true
        }
      )
      const result = await network.run(`${promptWithContext}${imageContext}`)

      const messages = result.state.results
        .flatMap((networkResult) => networkResult.output)
        .reverse()

      const lastTextMessage = messages.find(
        (message) =>
          message.role === "assistant" &&
          (message.type === "text" || ("content" in message && message.content))
      )

      if (!finalResponseSaved &&
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

      if (questions.length > 0) {
        finalAnswer = [
          "To help me find the right options, please answer:",
          ...questions.map(({ question }, index) => `${index + 1}. ${question}`),
        ].join("\n")
      } else if (!finalResponseSaved && !finalAnswer.trim()) {
        finalAnswer = "No response generated."

        status = "cancelled"
      } else if (!finalResponseSaved) {
        finalAnswer = finalAnswer.replace(/<clarifying_questions>[\s\S]*?<\/clarifying_questions>/i, "").trim()
      }
    } catch (error) {
      if (!finalResponseSaved) {
        status = "cancelled"
        finalAnswer =
          error instanceof Error
            ? `Error processing request: ${error.message}`
            : "An unexpected error occurred while processing the request."
      }
    }

    await step.run("update-convex-message", async () => {
      if (!finalResponseSaved) {
        await convex.mutation(api.messages.updateAssistantMessage, {
          assistantMessageId,
          content: finalAnswer,
          status,
          questions,
        })
      }
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
