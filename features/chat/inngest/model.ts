import { openai } from "@inngest/agent-kit"

// Keep provider and model selection in one place for every agentic AI call.
export const model = openai({
  model: "gpt-6-luna",
  apiKey: process.env.NITIASSIST_OPENAI_API_KEY,
  defaultParameters: {
    reasoning_effort: "none",

  } as any
})