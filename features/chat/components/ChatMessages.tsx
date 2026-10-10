"use client"

import { useEffect, useRef, useState } from "react"

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
import { Check, Copy, FileText, Loader } from "lucide-react"
import Image from "next/image"

type ChatMessage = Doc<"messages"> & {
  documents?: Array<{
    _id: string
    objectKey: string
    filename: string
    mimeType: string
    description?: string
    status: "processing" | "ready" | "failed"
  }>
}

type ChatMessagesProps = {
  messages: ChatMessage[] | undefined
  isLoading?: boolean
}

export function ChatMessages({
  messages,
  isLoading = false,
}: ChatMessagesProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (isLoading || messages === undefined) {
    return <ConversationEmptyState description="Loading your conversation..." />
  }

  if (messages.length === 0) {
    return <ConversationEmptyState />
  }

  return (
    <ConversationContent
      className="mx-auto w-full max-w-3xl gap-4 px-4 pt-6 pb-10 sm:px-6"
      scrollClassName="overflow-y-auto"
    >
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
              {message.documents?.length ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  {message.documents.map((document) => <StoredImage key={document._id} filename={document.filename} mimeType={document.mimeType} objectKey={document.objectKey} status={document.status} />)}
                </div>
              ) : null}
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
                    setCopiedMessageId(message._id)

                    if (copiedTimeoutRef.current) {
                      clearTimeout(copiedTimeoutRef.current)
                    }

                    copiedTimeoutRef.current = setTimeout(() => {
                      setCopiedMessageId(null)
                    }, 2000)
                  } catch {
                    // Ignore clipboard failures when the browser blocks access.
                  }
                }}
                size="icon"
                title="Copy message"
                variant="ghost"
              >
                {copiedMessageId === message._id ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </MessageActions>
          </Message>
        )
      })}
    </ConversationContent>
  )
}

function StoredImage({ filename, mimeType, objectKey, status }: { filename: string; mimeType: string; objectKey: string; status: "processing" | "ready" | "failed" }) {
  const [src, setSrc] = useState("")
  const [failed, setFailed] = useState(false)

  const load = async () => {
    const response = await fetch("/api/uploads/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "read", objectKey }),
    })
    if (!response.ok) throw new Error("Document is unavailable")
    const result = await response.json() as { readUrl: string }
    setSrc(result.readUrl)
    setFailed(false)
  }

  useEffect(() => {
    void load().catch(() => setFailed(true))
  }, [objectKey, status])

  const isImage = mimeType.startsWith("image/")
  return (
    <div className="overflow-hidden rounded-md border">
      {src && !failed && isImage ? <Image alt={filename} className="size-28 object-cover" height={112} onError={() => { void load().catch(() => setFailed(true)) }} src={src} unoptimized width={112} /> : src && !failed ? (
        <a className="flex size-28 flex-col items-center justify-center gap-2 bg-muted p-2 text-center text-xs text-primary" href={src} rel="noreferrer" target="_blank">
          <FileText className="size-8" /> Open PDF
        </a>
      ) : (
        <div className="flex size-28 items-center justify-center bg-muted p-2 text-center text-xs text-muted-foreground">
          {status === "processing" ? "Analyzing document…" : status === "failed" || failed ? "Document unavailable" : "Loading document…"}
        </div>
      )}
      <p className="max-w-28 truncate px-2 py-1 text-xs">{filename}</p>
    </div>
  )
}
