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
import { Logo } from "@/components/Logo"
import {
  cancelChatAgent,
  triggerChatAgent,
} from "../actions/process-message"
import { createConversationTitle } from "../actions/request-title"
import type { FileUIPart } from "ai"
import { useMarkDocumentFailed, useRegisterUploadedDocument } from "@/hooks/useDocuments"
import { uploadDocumentToLibrary } from "@/features/documents/upload-document"
import { toast } from "sonner"

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
  const registerUploadedDocument = useRegisterUploadedDocument()
  const markDocumentFailed = useMarkDocumentFailed()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingFiles, setIsUploadingFiles] = useState(false)
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

  const uploadFile = async (file: FileUIPart) => {
    if (!file.url || !file.mediaType || !file.filename) {
      throw new Error("The selected file could not be read.")
    }
    let image: Blob
    try {
      const response = await fetch(file.url)
      if (!response.ok) throw new Error("The selected file could not be read.")
      image = await response.blob()
    } catch {
      throw new Error("Could not read the selected file in your browser. Remove it and attach it again.")
    }
    const imageFile = new File([image], file.filename, { type: file.mediaType })
    return await uploadDocumentToLibrary(imageFile, registerUploadedDocument, markDocumentFailed)
  }

  const handleSubmit = async (text: string, files: FileUIPart[], selectedDocumentIds: Id<"documents">[]) => {
    if (!userId || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setIsUploadingFiles(files.length > 0)

    try {
      const uploadedDocumentIds = await Promise.all(files.map(uploadFile))
      setIsUploadingFiles(false)
      const documentIds = [...new Set([...selectedDocumentIds, ...uploadedDocumentIds])]
      const messageText = text || (documentIds.length ? "Please analyze the attached document." : "")
      const targetConversationId = conversationId ?? await createConversation({
        ownerId: userId,
        title: messageText.trim().replace(/\s+/g, " ").slice(0, 60) || "New conversation",
      })

      if (!conversationId) {
        await createConversationTitle(messageText, targetConversationId)
      }

      const { assistantMessageId } = await createMessageUser({
        content: messageText,
        conversationId: targetConversationId,
        documentIds,
      })

      setActiveAssistantMessageId(assistantMessageId)

      if (!conversationId) {
        router.push(`/${targetConversationId}`)
      }

      await triggerChatAgent({
        prompt: messageText,
        assistantMessageId,
        conversationId: targetConversationId,
        documentIds,
        conversationContext: recentMessages ?? [],
      })
    } catch (error) {
      setIsSubmitting(false)
      setIsUploadingFiles(false)
      toast.error(error instanceof Error ? error.message : "Could not submit your message.")
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
      isUploading={isUploadingFiles}
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
          {!isSubmitting ? <Logo className="h-20 w-auto" priority /> : null}
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
