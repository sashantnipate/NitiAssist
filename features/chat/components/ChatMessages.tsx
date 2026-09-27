"use client"

import {
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import type { Doc } from "@/convex/_generated/dataModel"
import { Loader2Icon } from "lucide-react"

type ChatMessagesProps = {
  messages: Doc<"messages">[] | undefined
  isLoading?: boolean
}

export function ChatMessages({
  messages,
  isLoading = false,
}: ChatMessagesProps) {
  if (isLoading || messages === undefined) {
    return <ConversationEmptyState description="Loading your conversation..." />
  }

  if (messages.length === 0) {
    return <ConversationEmptyState />
  }

  return (
    <ConversationContent className="mx-auto w-full max-w-3xl gap-10 px-4 pt-6 pb-10 sm:px-6">
      {messages.map((message) => {
        const isProcessing =
          message.role === "assistant" && message.status === "processing"
        const content =
          message.role === "assistant" && (isProcessing || !message.content)
            ? "Thinking"
            : message.content

        return (
          <Message from={message.role} key={message._id}>
            <MessageContent>
              {isProcessing ? (
                <div aria-live="polite" className="flex items-center gap-2">
                  <MessageResponse>{content}</MessageResponse>
                  <Loader2Icon
                    aria-label="Thinking"
                    className="size-5 animate-spin"
                  />
                </div>
              ) : (
                <MessageResponse>{content}</MessageResponse>
              )}
            </MessageContent>
          </Message>
        )
      })}
    </ConversationContent>
  )
}
