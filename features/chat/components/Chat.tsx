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
import type { FileUIPart } from "ai"
import { useRegisterUploadedDocument } from "@/hooks/useDocuments"
import { toast } from "sonner"

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
  const registerUploadedDocument = useRegisterUploadedDocument()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
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

  const uploadImage = async (file: FileUIPart) => {
    if (!file.url || !file.mediaType || !file.filename) {
      throw new Error("The selected image could not be read.")
    }
    let image: Blob
    try {
      const response = await fetch(file.url)
      if (!response.ok) throw new Error("The selected image could not be read.")
      image = await response.blob()
    } catch {
      throw new Error("Could not read the selected image in your browser. Remove it and attach it again.")
    }
    if (image.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.")
    let signedResponse: Response
    try {
      signedResponse = await fetch("/api/uploads/r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "upload", filename: file.filename, mimeType: file.mediaType, size: image.size }),
      })
    } catch {
      throw new Error("Could not reach the app upload endpoint. Check that the app is running and you are signed in.")
    }
    let signed: { objectKey?: string; uploadUrl?: string; error?: string }
    try {
      signed = await signedResponse.json()
    } catch {
      throw new Error(`The app upload endpoint returned an invalid response (${signedResponse.status}).`)
    }
    if (!signedResponse.ok || !signed.objectKey || !signed.uploadUrl) throw new Error(signed.error ?? "Could not prepare image upload.")

    let putResponse: Response
    try {
      putResponse = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.mediaType },
        body: image,
      })
    } catch {
      throw new Error("The upload to Cloudflare R2 was blocked. Check the bucket CORS policy allows PUT from this app's exact origin with the Content-Type header.")
    }
    if (!putResponse.ok) {
      throw new Error(`Cloudflare R2 rejected the upload (HTTP ${putResponse.status}). Check the R2 token permissions and signed upload URL.`)
    }

    try {
      return await registerUploadedDocument({
        objectKey: signed.objectKey,
        filename: file.filename,
        mimeType: file.mediaType,
        size: image.size,
      })
    } catch (error) {
      await fetch("/api/uploads/r2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "delete", objectKey: signed.objectKey }),
      })
      throw error
    }
  }

  const handleSubmit = async (text: string, files: FileUIPart[], selectedDocumentIds: Id<"documents">[]) => {
    if (!userId || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setIsUploadingImages(files.length > 0)

    try {
      const uploadedDocumentIds = await Promise.all(files.map(uploadImage))
      setIsUploadingImages(false)
      const documentIds = [...new Set([...selectedDocumentIds, ...uploadedDocumentIds])]
      const messageText = text || (documentIds.length ? "Please analyze the attached image." : "")
      const targetConversationId =
        conversationId ??
        (await createConversation({
          ownerId: userId,
          title: await getConversationTitle(messageText),
        }))

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
      setIsUploadingImages(false)
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
      isUploading={isUploadingImages}
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
