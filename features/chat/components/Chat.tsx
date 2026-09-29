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
} from "@/hooks/useConversation"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ChatMessages } from "./ChatMessages"
import { ChatPrompt } from "./ChatPrompt"
import {
  cancelChatAgent,
  triggerChatAgent,
} from "../actions/process-message"

type ChatProps = {
  conversationId?: Id<"conversations"> | null
}

function getConversationTitle(prompt: string) {
  const title = prompt.trim().slice(0, 15)

  return title || "New conversation"
}

export function Chat({ conversationId = null }: ChatProps) {
  const { userId } = useAuth()
  const router = useRouter()
  const messages = useMessages(conversationId)
  const recentMessages = useRecentMessages(conversationId)
  const createConversation = useCreateConversation()
  const createMessageUser = useCreateMessageUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeAssistantMessageId, setActiveAssistantMessageId] =
    useState<Id<"messages"> | null>(null)

  const processingAssistantMessage = messages
    ? [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && message.status === "processing"
        )
    : undefined

  useEffect(() => {
    if (!messages) {
      return
    }

    if (processingAssistantMessage) {
      setActiveAssistantMessageId(processingAssistantMessage._id)
      setIsSubmitting(true)
    } else if (activeAssistantMessageId) {
      setActiveAssistantMessageId(null)
      setIsSubmitting(false)
    }
  }, [activeAssistantMessageId, messages, processingAssistantMessage])

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
          title: getConversationTitle(text),
        }))

      const { assistantMessageId } = await createMessageUser({
        content: text,
        conversationId: targetConversationId,
      })

      setActiveAssistantMessageId(assistantMessageId)

      await triggerChatAgent({
        prompt: text,
        assistantMessageId,
        conversationId: targetConversationId,
        conversationContext: recentMessages ?? [],
      })

      if (!conversationId) {
        router.push(`/${targetConversationId}`)
      }
    } catch (error) {
      setIsSubmitting(false)
      throw error
    }
  }

  const handleCancel = async () => {
    const assistantMessageId =
      activeAssistantMessageId ?? processingAssistantMessage?._id

    if (!assistantMessageId) {
      return
    }

    await cancelChatAgent({
      assistantMessageId,
    })
  }

  const hasConversation = conversationId !== null
  const prompt = (
    <ChatPrompt
      disabled={!userId}
      isRunning={isSubmitting}
      onCancel={handleCancel}
      onSubmit={handleSubmit}
    />
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
