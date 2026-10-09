"use client"

import {
  Conversation,
  ConversationEmptyState,
  ConversationScrollButton,
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
import { createConversationTitle } from "../actions/create-title"

type ChatProps = {
  conversationId?: Id<"conversations"> | null
}

async function getConversationTitle(prompt: string) {
  return createConversationTitle(prompt)
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
          title: await getConversationTitle(text),
        }))

      const { assistantMessageId } = await createMessageUser({
        content: text,
        conversationId: targetConversationId,
      })

      setActiveAssistantMessageId(assistantMessageId)

      if (!conversationId) {
        router.push(`/${targetConversationId}`)
      }

      await triggerChatAgent({
        prompt: text,
        assistantMessageId,
        conversationId: targetConversationId,
        conversationContext: recentMessages ?? [],
      })
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
          <Conversation className="min-h-0 w-full flex-1">
            <ChatMessages messages={messages} />
            <ConversationScrollButton />
          </Conversation>
          <div className="sticky bottom-0 z-10 mt-auto w-full shrink-0 bg-background/95 px-4 pb-4 backdrop-blur sm:px-6">
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
