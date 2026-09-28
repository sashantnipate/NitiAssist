import {
  createAgent,
  createNetwork,
  createRoutingAgent,
  createTool,
  openai,
} from "@inngest/agent-kit";

import { z } from "zod";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { inngest } from "../../../inngest/client";

import {
  firecrawlSearchTool,
  firecrawlScrapeTool,
} from "./tools";

import {
  CONVERSATION_AGENT_PROMPT,
  WEB_AGENT_PROMPT,
} from "./constants";

const convex = new ConvexHttpClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);

const model = openai({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
});

const conversationAgent = createAgent({
  name: "Conversation Agent",

  description:
    "Handles greetings, casual conversation, general questions, explanations, and applicant discussions that do not require current web research.",

  system: CONVERSATION_AGENT_PROMPT,

  model,
});


const webAgent = createAgent({
  name: "Financial Policy Web Agent",

  description:
    "Researches government subsidies, schemes, tax benefits, financial assistance, eligibility rules, required documents, benefit amounts, deadlines, and application procedures using current internet information.",

  system: WEB_AGENT_PROMPT,

  model,

  tools: [
    firecrawlSearchTool,
    firecrawlScrapeTool,
  ],
});


const routeToAgentTool = createTool({
  name: "route_to_agent",

  description:
    "Route the current user request to the appropriate specialist agent.",

  parameters: z.object({
    agent: z
      .string()
      .describe(
        "The exact name of the agent that should handle the request."
      ),
  }),

  handler: async ({ agent }, { network }) => {
    if (!network) {
      throw new Error(
        "Routing tool must run inside an AgentKit network."
      );
    }

    const selectedAgent = network.agents.get(agent);

    if (!selectedAgent) {
      throw new Error(
        `Agent "${agent}" does not exist in this network.`
      );
    }

    return selectedAgent.name;
  },
});

const doneTool = createTool({
  name: "done",

  description:
    "Call this when the user's request has been completely handled and no additional agent should be executed.",

  handler: async () => {
    return "done";
  },
});


const routingAgent = createRoutingAgent({
  name: "Financial Policy Routing Agent",

  description:
    "Supervises the financial policy assistant and decides which specialist agent should handle the user's request.",

  model,

  system: `
You are the supervisor for a Financial Policy Assistant.

Your job is to decide which specialist agent should handle the
user's CURRENT request.

Available specialist agents:

1. Conversation Agent
- Greetings
- Casual conversation
- General questions
- Explanations
- Applicant discussions
- Requests that do not require current internet research

2. Financial Policy Web Agent
- Government schemes
- Government subsidies
- Grants
- Financial assistance
- Tax benefits
- Tax deductions
- Eligibility requirements
- Required documents
- Benefit amounts
- Deadlines
- Application procedures
- Current government policy information
- Requests requiring current web research

IMPORTANT ROUTING BEHAVIOR:

1. First, look at the user's current request and decide which
   specialist should handle it.

2. If the request has NOT yet been answered by a specialist,
   use route_to_agent.

3. After a specialist agent has already provided a complete answer
   to the user's current request, ALWAYS call done.

4. NEVER route the same request to the same specialist again
   after that specialist has already answered it.

5. For a simple greeting such as "Hello":
   - Route to Conversation Agent once.
   - After Conversation Agent responds, call done.
   - Do NOT route to Conversation Agent again.

6. For a financial-policy request:
   - Route to Financial Policy Web Agent.
   - Allow it to use its tools and complete the research.
   - After it has produced the final answer, call done.

7. Only route to another agent if the previous agent explicitly
   failed to answer the request or another specialist is genuinely
   required.

8. Do not answer the user yourself.

9. Do not call route_to_agent more than necessary.

Use:
- route_to_agent when another specialist must act.
- done when the user's request has been completely handled.

Think about the previous agent's response before choosing a tool.
`,

  tools: [
    routeToAgentTool,
    doneTool,
  ],

  lifecycle: {
  onRoute: ({ result, network }) => {
    if (!network) {
      throw new Error(
        "Routing agent must run inside an AgentKit network."
      );
    }

    const tool = result.toolCalls[0];

    if (!tool) {
      return;
    }

    const toolName = tool.tool.name;

    // Routing agent says the task is complete.
    if (toolName === "done") {
      return;
    }

    // Routing agent selected an agent.
    if (toolName === "route_to_agent") {
      if (
        typeof tool.content === "object" &&
        tool.content !== null &&
        "data" in tool.content &&
        typeof tool.content.data === "string"
      ) {
        const selectedAgent = tool.content.data;

        if (!network.agents.has(selectedAgent)) {
          throw new Error(
            `Routing agent selected unknown agent: ${selectedAgent}`
          );
        }

        return [selectedAgent];
      }
    }

    return;
  },
},
});


const network = createNetwork({
  name: "Financial Policy Assistant",

  agents: [
    conversationAgent,
    webAgent,
  ],

  defaultModel: model,

  router: routingAgent,

  maxIter: 5,
});


export const processChatMessage = inngest.createFunction(
  {
    id: "process-chat-message",

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
      prompt: string;
      assistantMessageId: Id<"messages">;
      conversationId: Id<"conversations">;
      conversationContext?: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
    };

    void conversationId;

    const history = conversationContext
      .map(({ role, content }) =>
        `${role === "user" ? "User" : "Assistant"}: ${content}`
      )
      .join("\n\n");

    const promptWithContext = history
      ? `Conversation history:\n${history}\n\nCurrent user request:\n${prompt}`
      : `Current user request:\n${prompt}`;

    let finalAnswer = "";

    let status: "completed" | "cancelled" =
      "completed";

    try {
      console.log(
        "Starting financial policy network:",
        promptWithContext
      );

      const result = await network.run(promptWithContext);

      console.log("Network completed.");


      const lastResult =
        result.state.results.at(-1);

      const messages =
        lastResult?.output ?? [];

      const lastTextMessage = [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" &&
            (
              message.type === "text" ||
              (
                "content" in message &&
                message.content
              )
            )
        );

      if (
        lastTextMessage &&
        "content" in lastTextMessage &&
        lastTextMessage.content
      ) {

        if (
          typeof lastTextMessage.content ===
          "string"
        ) {
          finalAnswer =
            lastTextMessage.content;
        }

        else if (
          Array.isArray(
            lastTextMessage.content
          )
        ) {
          finalAnswer =
            lastTextMessage.content
              .map((item) => {
                if (
                  typeof item === "string"
                ) {
                  return item;
                }

                if (
                  typeof item === "object" &&
                  item !== null &&
                  "text" in item
                ) {
                  return String(item.text);
                }

                return "";
              })
              .join("");
        }
      }


      if (!finalAnswer.trim()) {
        finalAnswer =
          "No response generated.";

        status = "cancelled";
      }
    } catch (error) {
      console.error(
        "Financial Policy Network Error:",
        error
      );

      status = "cancelled";

      finalAnswer =
        error instanceof Error
          ? `OpenAI error: ${error.message}`
          : "Unknown error";
    }


    await step.run(
      "update-convex-message",
      async () => {
        await convex.mutation(
          api.messages.updateAssistantMessage,
          {
            assistantMessageId,
            content: finalAnswer,
            status,
          }
        );
      }
    );

    return {
      success: status === "completed",
    };
  }
);
