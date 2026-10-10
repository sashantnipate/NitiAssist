"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileText, ImagePlus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  useDeleteDocument,
  useDocumentLibrary,
  useMarkDocumentFailed,
  useRegisterUploadedDocument,
} from "@/hooks/useDocuments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadDocumentToLibrary, ACCEPTED_DOCUMENT_TYPES } from "@/features/documents/upload-document";

type LibraryProps = {
  selectedDocumentIds?: Id<"documents">[];
  onToggleDocument?: (id: Id<"documents">) => void;
  onDeleteDocument?: (id: Id<"documents">) => void;
  showUploadButton?: boolean;
};

export function Library({ showUploadButton = false }: LibraryProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const register = useRegisterUploadedDocument();
  const markFailed = useMarkDocumentFailed();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const selectedFiles = Array.from(files);
      const results: PromiseSettledResult<Id<"documents">>[] = [];
      for (let index = 0; index < selectedFiles.length; index += 3) {
        const batch = selectedFiles.slice(index, index + 3);
        results.push(...await Promise.allSettled(batch.map((file) => uploadDocumentToLibrary(file, register, markFailed))));
      }
      const uploaded = results.filter((result) => result.status === "fulfilled").length;
      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (uploaded) {
        toast.success(`${uploaded} ${uploaded === 1 ? "document" : "documents"} uploaded. Inngest is analyzing ${uploaded === 1 ? "it" : "them"} in the background.`);
      }
      if (failures.length) {
        const firstError = failures[0].reason;
        const message = firstError instanceof Error ? firstError.message : "Could not upload the document.";
        toast.error(`${failures.length} ${failures.length === 1 ? "upload failed" : "uploads failed"}. ${message}`);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Your documents</h2>
          <p className="mt-1 text-sm text-muted-foreground">Images and PDFs are stored privately and named from their contents.</p>
        </div>
        {showUploadButton ? (
          <>
            <input
              ref={inputRef}
              accept={[...ACCEPTED_DOCUMENT_TYPES].join(",")}
              className="sr-only"
              multiple
              onChange={(event) => void handleFiles(event.target.files)}
              type="file"
            />
            <Button disabled={uploading} onClick={() => inputRef.current?.click()} type="button">
              <Upload /> {uploading ? "Uploading…" : "Upload documents"}
            </Button>
          </>
        ) : null}
      </header>
      {showUploadButton ? <p className="-mt-4 text-xs text-muted-foreground">JPG, PNG, WEBP, GIF, or PDF. Up to 10 MB each.</p> : null}
      <LibraryGallery />
    </section>
  );
}

export function LibraryGallery({ selectedDocumentIds = [], onToggleDocument, onDeleteDocument }: Omit<LibraryProps, "showUploadButton">) {
  const documents = useDocumentLibrary();
  const deleteDocument = useDeleteDocument();

  if (documents === undefined) {
    return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <LibraryDocumentSkeleton key={index} />)}</div>;
  }

  if (documents.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Your uploaded images and PDFs will appear here.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {documents.map((document) => (
        <LibraryDocument
          key={document._id}
          document={document}
          selected={selectedDocumentIds.includes(document._id)}
          onSelect={onToggleDocument ? () => onToggleDocument(document._id) : undefined}
          onDelete={async () => {
            const response = await fetch("/api/uploads/r2", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ operation: "delete", objectKey: document.objectKey }),
            });
            if (!response.ok) throw new Error("Could not delete this document.");
            await deleteDocument({ documentId: document._id });
            onDeleteDocument?.(document._id);
          }}
        />
      ))}
    </div>
  );
}

function LibraryDocumentSkeleton() {
  return (
    <div className="overflow-hidden rounded-md border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <Skeleton className="mx-2 my-3 h-3 w-2/3" />
      <Skeleton className="m-2 h-8 w-20" />
    </div>
  );
}

function LibraryDocument({
  document,
  selected,
  onSelect,
  onDelete,
}: {
  document: Doc<"documents">;
  selected: boolean;
  onSelect?: () => void;
  onDelete: () => Promise<void>;
}) {
  const [src, setSrc] = useState("");
  const [urlLoading, setUrlLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isImage = document.mimeType.startsWith("image/");

  useEffect(() => {
    let active = true;
    setSrc("");
    setUrlLoading(true);
    setImageLoaded(false);
    void fetch("/api/uploads/r2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operation: "read", objectKey: document.objectKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ readUrl: string }>;
      })
      .then((result) => {
        if (active) {
          setSrc(result.readUrl);
          setUrlLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setSrc("");
          setUrlLoading(false);
        }
      });
    return () => { active = false; };
  }, [document.objectKey]);

  return (
    <div className={`overflow-hidden rounded-md border ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="relative">
        {urlLoading ? <Skeleton className="absolute inset-0 aspect-square w-full rounded-none" /> : null}
        {src && isImage ? (
          <button aria-label={`View ${document.filename} full size`} className="block w-full cursor-zoom-in" onClick={() => setPreviewOpen(true)} type="button">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={document.filename} className="block h-auto w-full" onLoad={() => setImageLoaded(true)} onError={() => setSrc("")} src={src} />
          </button>
        ) : src ? (
          <a className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted text-sm hover:bg-muted/70" href={src} rel="noreferrer" target="_blank">
            <FileText className="size-10 text-primary" />
            <span>Open PDF</span>
          </a>
        ) : (
          <div className="flex aspect-square flex-col items-center justify-center gap-2 bg-muted text-xs text-muted-foreground">
            {document.status === "processing" ? "Analyzing document…" : document.status === "failed" ? "Analysis failed" : "Preview unavailable"}
          </div>
        )}
        {src && isImage && !imageLoaded ? <Skeleton className="absolute inset-0 aspect-square w-full rounded-none" /> : null}
        {onSelect ? (
          <Button
            aria-label={`${selected ? "Deselect" : "Select"} ${document.filename}`}
            aria-pressed={selected}
            className="absolute right-2 top-2 shadow-sm"
            disabled={document.status !== "ready"}
            onClick={onSelect}
            size="icon-sm"
            type="button"
            variant={selected ? "default" : "secondary"}
          >
            {selected ? <Check className="size-4" /> : <span className="size-3 rounded-sm border border-current" />}
          </Button>
        ) : null}
      </div>
      <div className="p-2">
        <span className="block truncate text-xs font-medium">{document.filename}</span>
        {document.status === "failed" ? (
          <p className="mt-1 line-clamp-3 text-xs text-destructive">
            {document.analysisError || "Document analysis failed. Try uploading it again."}
          </p>
        ) : null}
        {document.description ? <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{document.description}</p> : null}
        {document.description ? (
          <button className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={() => setPreviewOpen(true)} type="button">
            View extracted details
          </button>
        ) : null}
      </div>
      <Button
        aria-label={`Delete ${document.filename}`}
        className="m-1"
        disabled={deleting}
        onClick={async () => {
          setDeleting(true);
          try { await onDelete(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete document."); }
          finally { setDeleting(false); }
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Trash2 className="size-4" /> Delete
      </Button>
      <Dialog onOpenChange={setPreviewOpen} open={previewOpen}>
        <DialogContent className="max-h-[95vh] w-[calc(100%-2rem)] max-w-6xl overflow-y-auto p-4 sm:max-w-6xl">
          <DialogHeader><DialogTitle className="truncate pr-8">{document.filename}</DialogTitle></DialogHeader>
          {src && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={document.filename} className="mx-auto max-h-[82vh] max-w-full object-contain" src={src} />
          ) : src ? <iframe className="h-[80vh] w-full" src={src} title={document.filename} /> : null}
          {document.description ? (
            <section className="mt-4 rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Extracted information</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{document.description}</p>
            </section>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
