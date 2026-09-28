"use client"

import {
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import { Button } from "@/components/ui/button"
import type { Doc } from "@/convex/_generated/dataModel"
import { Copy, Loader } from "lucide-react"

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
                  <Loader
                    aria-label="Thinking"
                    className="size-5 animate-spin"
                  />
                </div>
              ) : (
                <MessageResponse>{content}</MessageResponse>
              )}
            </MessageContent>
            <MessageActions className="ml-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 group-[.is-user]:ml-auto">
              <Button
                aria-label="Copy message"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(content)
                  } catch {
                    // Ignore clipboard failures when the browser blocks access.
                  }
                }}
                size="icon"
                title="Copy message"
                variant="ghost"
              >
                <Copy className="size-4" />
              </Button>
            </MessageActions>
          </Message>
        )
      })}
    </ConversationContent>
  )
}
