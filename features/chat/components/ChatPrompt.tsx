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
import { useDocumentLibrary, useDeleteDocument } from "@/hooks/useDocuments"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { ImagePlus, Paperclip, Square, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"
import type { FileUIPart } from "ai"
import { toast } from "sonner"

type ChatPromptProps = {
  disabled?: boolean
  isRunning?: boolean
  isUploading?: boolean
  onCancel?: () => void | Promise<void>
  onSubmit: (text: string, files: FileUIPart[], documentIds: Id<"documents">[]) => void | Promise<void>
}

function PendingImagePreviews() {
  const attachments = usePromptInputAttachments()
  if (!attachments.files.length) return null
  return (
    <div className="flex w-full flex-wrap justify-start gap-2">
      {attachments.files.map((file) => (
        <div className="relative size-16 overflow-hidden rounded-md border" key={file.id}>
          {file.url ? <img alt={file.filename ?? "Selected image"} className="size-full object-cover" src={file.url} /> : null}
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
      <PendingImagePreviews />
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
  const deleteDocument = useDeleteDocument()

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
      accept="image/jpeg,image/png,image/webp,image/gif"
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
          <Button aria-label="Choose saved images" onClick={() => setIsLibraryOpen(true)} size="icon" title="Choose saved images" type="button" variant="ghost">
            <ImagePlus className="size-4" />
          </Button>
        </div>
        <span aria-live="polite" className="mr-auto px-2 text-xs text-muted-foreground">
          {isUploading ? "Uploading images…" : isBusy ? "Assistant is working…" : ""}
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
          <DialogHeader><DialogTitle>Your saved images</DialogTitle></DialogHeader>
          {!library ? <p className="text-sm text-muted-foreground">Loading images…</p> : library.length === 0 ? <p className="text-sm text-muted-foreground">Your uploaded images will appear here.</p> : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {library.map((document) => <LibraryImage key={document._id} document={document} selected={selectedDocumentIds.includes(document._id)} onSelect={() => setSelectedDocumentIds((ids) => ids.includes(document._id) ? ids.filter((id) => id !== document._id) : [...ids, document._id])} onDelete={async () => {
                const response = await fetch("/api/uploads/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "delete", objectKey: document.objectKey }) })
                if (!response.ok) throw new Error("Could not delete this image.")
                await deleteDocument({ documentId: document._id })
                setSelectedDocumentIds((ids) => ids.filter((id) => id !== document._id))
              }} />)}
            </div>
          )}
          <div className="flex justify-end"><Button onClick={() => setIsLibraryOpen(false)} type="button">Done</Button></div>
        </DialogContent>
      </Dialog>
    </PromptInput>
  )
}

function PromptFileButton() {
  const attachments = usePromptInputAttachments()
  return <Button aria-label="Attach images" onClick={attachments.openFileDialog} size="icon" title="Attach images" type="button" variant="ghost"><Paperclip className="size-4" /></Button>
}

function PromptSubmitControl({ hasPromptText, disabled }: { hasPromptText: boolean; disabled: boolean }) {
  const attachments = usePromptInputAttachments()
  return <PromptInputSubmit aria-label="Submit prompt" className="size-9 [&>svg]:size-5" disabled={disabled || (!hasPromptText && !attachments.files.length)} title="Submit prompt" />
}

function LibraryImage({ document, selected, onSelect, onDelete }: { document: Doc<"documents">; selected: boolean; onSelect: () => void; onDelete: () => Promise<void> }) {
  const [src, setSrc] = useState("")
  const [deleting, setDeleting] = useState(false)
  useEffect(() => {
    void fetch("/api/uploads/r2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "read", objectKey: document.objectKey }) })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() })
      .then((result: { readUrl: string }) => setSrc(result.readUrl))
      .catch(() => setSrc(""))
  }, [document.objectKey, document.status])

  return (
    <div className={`overflow-hidden rounded-md border ${selected ? "ring-2 ring-primary" : ""}`}>
      <button className="block w-full text-left" disabled={document.status === "processing"} onClick={onSelect} type="button">
        {src ? <img alt={document.filename} className="aspect-square w-full object-cover" src={src} /> : <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">{document.status}</div>}
        <span className="block truncate p-2 text-xs">{document.filename}</span>
      </button>
      <Button aria-label={`Delete ${document.filename}`} className="m-1" disabled={deleting} onClick={async () => { setDeleting(true); try { await onDelete() } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete image.") } finally { setDeleting(false) } }} size="sm" type="button" variant="ghost">
        {deleting ? <Spinner className="size-4" /> : <Trash2 className="size-4" />} Delete
      </Button>
    </div>
  )
}
