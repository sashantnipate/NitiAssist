"use client"

import { useEffect, useState } from "react"
import { Check, Trash2 } from "lucide-react"
import { toast } from "sonner"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { useDeleteDocument, useDocumentLibrary } from "@/hooks/useDocuments"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

type LibraryProps = {
  selectedDocumentIds?: Id<"documents">[]
  onToggleDocument?: (id: Id<"documents">) => void
  onDeleteDocument?: (id: Id<"documents">) => void
}

export function Library() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your uploaded documents and images.</p>
        </div>
      </header>
      <LibraryGallery />
    </main>
  )
}

export function LibraryGallery({ selectedDocumentIds = [], onToggleDocument, onDeleteDocument }: LibraryProps) {
  const documents = useDocumentLibrary()
  const deleteDocument = useDeleteDocument()

  if (documents === undefined) {
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <LibraryImageSkeleton key={index} />)}</div>
  }

  if (documents.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Images you upload during chats will appear here.</p>
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {documents.map((document) => (
        <LibraryImage
          key={document._id}
          document={document}
          selected={selectedDocumentIds.includes(document._id)}
          onSelect={onToggleDocument ? () => onToggleDocument(document._id) : undefined}
          onDelete={async () => {
            const response = await fetch("/api/uploads/r2", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operation: "delete", objectKey: document.objectKey }),
            })
            if (!response.ok) throw new Error("Could not delete this image.")
            await deleteDocument({ documentId: document._id })
            onDeleteDocument?.(document._id)
          }}
        />
      ))}
    </div>
  )
}

function LibraryImageSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <Skeleton className="mx-2 my-3 h-3 w-2/3" />
      <Skeleton className="m-2 h-8 w-20" />
    </div>
  )
}

function LibraryImage({
  document,
  selected,
  onSelect,
  onDelete,
}: {
  document: Doc<"documents">
  selected: boolean
  onSelect?: () => void
  onDelete: () => Promise<void>
}) {
  const [src, setSrc] = useState("")
  const [urlLoading, setUrlLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    let active = true
    setSrc("")
    setUrlLoading(true)
    setImageLoaded(false)
    void fetch("/api/uploads/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "read", objectKey: document.objectKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json() as Promise<{ readUrl: string }>
      })
      .then((result) => {
        if (active) {
          setSrc(result.readUrl)
          setUrlLoading(false)
        }
      })
      .catch(() => {
        if (active) {
          setSrc("")
          setUrlLoading(false)
        }
      })
    return () => { active = false }
  }, [document.objectKey])

  return (
    <div className={`overflow-hidden rounded-md border ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="relative">
        {(urlLoading || (src && !imageLoaded)) ? <Skeleton className="absolute inset-0 aspect-square w-full rounded-none" /> : null}
        {src ? (
          <button
            aria-label={`View ${document.filename} full size`}
            className="block w-full cursor-zoom-in"
            onClick={() => setPreviewOpen(true)}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={document.filename} className="block h-auto w-full" onLoad={() => setImageLoaded(true)} onError={() => setSrc("")} src={src} />
          </button>
        ) : (
          <div className="flex aspect-square items-center justify-center bg-muted text-xs text-muted-foreground">
            {urlLoading ? null : document.status === "processing" ? "Processing image" : document.status === "failed" ? "Image unavailable" : "Could not load image"}
          </div>
        )}
        {onSelect ? (
          <Button
            aria-label={`${selected ? "Deselect" : "Select"} ${document.filename}`}
            aria-pressed={selected}
            className="absolute right-2 top-2 shadow-sm"
            disabled={document.status === "processing"}
            onClick={onSelect}
            size="icon-sm"
            type="button"
            variant={selected ? "default" : "secondary"}
          >
            {selected ? <Check className="size-4" /> : <span className="size-3 rounded-sm border border-current" />}
          </Button>
        ) : null}
      </div>
      <span className="block truncate p-2 text-xs">{document.filename}</span>
      <Button
        aria-label={`Delete ${document.filename}`}
        className="m-1"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true)
          try { await onDelete() } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete image.") }
          finally { setDeleting(false) }
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" /> Delete
      </Button>
      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="max-h-[95vh] w-[calc(100%-2rem)] max-w-6xl overflow-hidden p-4 sm:max-w-6xl">
          <DialogHeader><DialogTitle className="truncate pr-8">{document.filename}</DialogTitle></DialogHeader>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={document.filename} className="mx-auto max-h-[82vh] max-w-full object-contain" src={src} />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
