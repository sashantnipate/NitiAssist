"use client"

import {
  Conversation,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation"
import { useAuth } from "@clerk/nextjs"
import type { Id } from "@/convex/_generated/dataModel"
import {
  useCreateConversation,
  useCreateMessageUser,
  useMessages,
  useRecentMessages,
  useUpdateAssistantMessage,
} from "@/hooks/useConversation"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { ChatMessages } from "./ChatMessages"
import { ChatPrompt } from "./ChatPrompt"
import { triggerChatAgent } from "../actions/process-message"

type ChatProps = {
  conversationId?: Id<"conversations"> | null
}

export function Chat({ conversationId = null }: ChatProps) {
  const { userId } = useAuth()
  const router = useRouter()
  const messages = useMessages(conversationId)
  const recentMessages = useRecentMessages(conversationId)
  const createConversation = useCreateConversation()
  const createMessageUser = useCreateMessageUser()
  const updateAssistantMessage = useUpdateAssistantMessage()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (text: string) => {
    if (!userId || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      const targetConversationId =
        conversationId ??
        (await createConversation({
          ownerId: userId,
          title: "New conversation",
        }))

      const { assistantMessageId } = await createMessageUser({
        content: text,
        conversationId: targetConversationId,
      })

      await triggerChatAgent({
        prompt: text,
        assistantMessageId,
        conversationId: targetConversationId,
        conversationContext: recentMessages ?? [],
      })

      if (!conversationId) {
        router.push(`/${targetConversationId}`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasConversation = conversationId !== null
  const prompt = (
    <ChatPrompt disabled={!userId || isSubmitting} onSubmit={handleSubmit} />
  )

  return (
    <main className="flex h-svh min-h-svh min-w-0 flex-1 flex-col items-center overflow-hidden">
      {hasConversation ? (
        <>
          <Conversation className="min-h-0 w-full flex-1 overflow-y-auto">
            <ChatMessages messages={messages} />
          </Conversation>
          <div className="sticky bottom-0 z-10 mt-auto w-full shrink-0 bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
            <div className="mx-auto w-full max-w-3xl">{prompt}</div>
          </div>
        </>
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-6 px-4">
          <ConversationEmptyState
            className="size-auto p-0"
            description="Ask a question to start a new conversation."
            title="How can I help?"
          />
          <div className="w-full max-w-3xl">{prompt}</div>
        </div>
      )}
    </main>
  )
}
