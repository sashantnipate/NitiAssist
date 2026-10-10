"use client"

import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useDocumentLibrary } from "@/hooks/useDocuments"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { FileText, ImagePlus, Paperclip, Square, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { FileUIPart } from "ai"
import { toast } from "sonner"
import { LibraryGallery, LibraryUploadButton } from "@/features/chat/components/Library"
import { ACCEPTED_DOCUMENT_TYPES } from "@/features/documents/upload-document"

type ChatPromptProps = {
  disabled?: boolean
  isRunning?: boolean
  isUploading?: boolean
  onCancel?: () => void | Promise<void>
  onSubmit: (text: string, files: FileUIPart[], documentIds: Id<"documents">[]) => void | Promise<void>
}

function PendingFilePreviews() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null
  return (
    <div className="flex w-full flex-wrap justify-start gap-2">
      {attachments.files.map((file) => (
        <div className="relative size-16 overflow-hidden rounded-md border" key={file.id}>
          {file.mediaType?.startsWith("image/") && file.url ? (
            <img alt={file.filename ?? "Selected image"} className="size-full object-cover" src={file.url} />
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted p-1 text-center">
              <FileText className="size-6 text-primary" />
              <span className="w-full truncate text-[10px]">{file.filename ?? "Document"}</span>
            </div>
          )}
          <button aria-label={`Remove ${file.filename ?? "image"}`} className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-1" onClick={() => attachments.remove(file.id)} type="button">
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

function PromptAttachmentsHeader({
  selectedDocumentIds,
  library,
  onRemoveSelected,
}: {
  selectedDocumentIds: Id<"documents">[]
  library: Doc<"documents">[] | undefined
  onRemoveSelected: (id: Id<"documents">) => void
}) {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0 && selectedDocumentIds.length === 0) {
    return null
  }

  return (
    <PromptInputHeader className="w-full flex-col items-start justify-start px-3 pt-3">
      <PendingFilePreviews />
      {selectedDocumentIds.length > 0 ? (
        <div className="flex w-full flex-wrap justify-start gap-2">
          {selectedDocumentIds.map((id) => {
            const document = library?.find((item) => item._id === id)
            return document ? (
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs" key={id}>
                {document.filename}
                <button aria-label={`Remove ${document.filename}`} onClick={() => onRemoveSelected(id)} type="button">
                  <X className="size-3" />
                </button>
              </span>
            ) : null
          })}
        </div>
      ) : null}
    </PromptInputHeader>
  )
}

export function ChatPrompt({
  disabled = false,
  isRunning = false,
  isUploading = false,
  onCancel,
  onSubmit,
}: ChatPromptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [value, setValue] = useState("")
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Id<"documents">[]>([])
  const [isLibraryOpen, setIsLibraryOpen] = useState(false)
  const library = useDocumentLibrary()

  const handleSubmit = async ({ text, files }: { text: string; files: FileUIPart[] }) => {
    const promptText = text.trim()

    if ((!promptText && !files.length && !selectedDocumentIds.length) || disabled || isBusy || isCancelling) {
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(promptText, files, selectedDocumentIds)
      setValue("")
      setSelectedDocumentIds([])
    } finally {
      setIsSubmitting(false)
    }
  }

  const isBusy = isRunning || isSubmitting

  useEffect(() => {
    if (!isBusy) {
      setIsCancelling(false)
    }
  }, [isBusy])

  const handleCancel = async () => {
    if (!onCancel || isCancelling) {
      return
    }

    setIsCancelling(true)

    try {
      await onCancel()
    } catch {
      setIsCancelling(false)
    }
  }

  return (
    <PromptInput
      aria-label="Send a message"
      className="w-full text-base"
      accept={[...ACCEPTED_DOCUMENT_TYPES].join(",")}
      maxFiles={4}
      maxFileSize={10 * 1024 * 1024}
      multiple
      onError={(error) => toast.error(error.message)}
      onSubmit={handleSubmit}
    >
      <PromptAttachmentsHeader
        library={library}
        onRemoveSelected={(id) => setSelectedDocumentIds((ids) => ids.filter((item) => item !== id))}
        selectedDocumentIds={selectedDocumentIds}
      />
      <PromptInputBody>
        <PromptInputTextarea
          className="!min-h-12 max-h-32 text-base"
          onChange={(event) => setValue(event.target.value)}
          value={value}
        />
      </PromptInputBody>
      <PromptInputFooter className="justify-between">
        <div className="flex items-center gap-1">
          <PromptFileButton />
          <Button aria-label="Choose reference documents" onClick={() => setIsLibraryOpen(true)} size="icon" title="Choose reference documents" type="button" variant="ghost">
            <ImagePlus className="size-4" />
          </Button>
        </div>
        <span aria-live="polite" className="mr-auto px-2 text-xs text-muted-foreground">
          {isUploading ? "Uploading documents…" : isBusy ? "Assistant is working…" : ""}
        </span>
        {isBusy ? (
          <Button
            aria-label="Stop"
            className="size-9 [&>svg]:size-5"
            disabled={disabled || !onCancel || isCancelling}
            onClick={() => void handleCancel()}
            size="icon"
            type="button"
            title="Stop generating"
          >
            {isSubmitting || isCancelling ? (
              <Spinner className="size-5" />
            ) : (
              <Square className="size-5" />
            )}
          </Button>
        ) : (
          <PromptSubmitControl
            disabled={disabled}
            hasPromptText={Boolean(value.trim() || selectedDocumentIds.length)}
          />
        )}
      </PromptInputFooter>
      <Dialog onOpenChange={setIsLibraryOpen} open={isLibraryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>Reference documents</DialogTitle></DialogHeader>
          <div className="flex justify-end">
            <LibraryUploadButton />
          </div>
          <LibraryGallery
            onDeleteDocument={(id) => setSelectedDocumentIds((ids) => ids.filter((item) => item !== id))}
            onToggleDocument={(id) => setSelectedDocumentIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])}
            selectedDocumentIds={selectedDocumentIds}
          />
          <div className="flex justify-end"><Button onClick={() => setIsLibraryOpen(false)} type="button">Done</Button></div>
        </DialogContent>
      </Dialog>
    </PromptInput>
  )
}

function PromptFileButton() {
  const attachments = usePromptInputAttachments()
  return <Button aria-label="Attach images or PDF" onClick={attachments.openFileDialog} size="icon" title="Attach images or PDF" type="button" variant="ghost"><Paperclip className="size-4" /></Button>
}

function PromptSubmitControl({ hasPromptText, disabled }: { hasPromptText: boolean; disabled: boolean }) {
  const attachments = usePromptInputAttachments()
  return <PromptInputSubmit aria-label="Submit prompt" className="size-9 [&>svg]:size-5" disabled={disabled || (!hasPromptText && !attachments.files.length)} title="Submit prompt" />
}
