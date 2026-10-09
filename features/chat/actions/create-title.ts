"use server"

import { auth } from "@clerk/nextjs/server"

const MODEL = "gpt-4o-mini"

function fallbackTitle(prompt: string) {
  const title = prompt.trim().replace(/\s+/g, " ").slice(0, 60).trim()

  return title || "New conversation"
}

export async function createConversationTitle(prompt: string) {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("You must be signed in to create a conversation title.")
  }

  const trimmedPrompt = prompt.trim()

  if (!trimmedPrompt) {
    return "New conversation"
  }

  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return fallbackTitle(trimmedPrompt)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              "Create a concise conversation title from the user's message. Return only the title, using at most 6 words and no quotation marks.",
          },
          { role: "user", content: trimmedPrompt.slice(0, 4000) },
        ],
        max_tokens: 40,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      return fallbackTitle(trimmedPrompt)
    }

    const result = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const title = result.choices?.[0]?.message?.content
      ?.trim()
      .replace(/^['"]+|['"]+$/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 60)
      .trim()

    return title || fallbackTitle(trimmedPrompt)
  } catch {
    return fallbackTitle(trimmedPrompt)
  }
}
