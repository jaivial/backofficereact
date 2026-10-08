import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";

import { formatBytes } from "../../../../../api/bookingDocuments";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
} from "../../../../../ui/shadcn/attachment";
import { cn } from "../../../../../ui/shadcn/utils";

/**
 * Title + drop zone for one booking document, built on the shadcn Attachment
 * primitives (ui/shadcn/attachment.tsx) with the repo's bo-* styles. The row
 * layout reuses the `crear-stackFields` grid pattern; the attachment surface
 * accepts both drop and click and previews images.
 * Coordination id: booking_documents_v1
 */
export function DocumentAttachmentField({
  index,
  title,
  file,
  busy,
  disabled,
  state = "done",
  onTitleChange,
  onFileChange,
  onRemove,
  testId = "booking-document-row",
}: {
  /** Row index, so every control gets a unique data-testid. */
  index: number;
  title: string;
  file: File | null;
  busy?: boolean;
  disabled?: boolean;
  state?: "idle" | "uploading" | "error" | "done";
  onTitleChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onRemove?: () => void;
  testId?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();

  const pushFile = useCallback(
    (next: File | null | undefined) => {
      if (!next || disabled || busy) return;
      onFileChange(next);
      if (!title.trim()) onTitleChange(next.name.replace(/\.[^.]+$/, ""));
    },
    [busy, disabled, onFileChange, onTitleChange, title],
  );

  const isImage = Boolean(file && file.type.startsWith("image/"));
  const previewUrl = useImagePreviewUrl(file);

  return (
    <div
      className="bo-stackFields"
      data-slot="crear-stackFields"
      data-testid={`${testId}-${index}`}
      data-document-index={index}
    >
      <div className="bo-field" data-slot="crear-field" data-testid={`${testId}-${index}-title-field`}>
        <label className="bo-label" htmlFor={titleId} data-slot="crear-label">
          Título del documento
        </label>
        <input
          id={titleId}
          className="bo-input"
          value={title}
          placeholder="Nombre del documento"
          onChange={(event) => onTitleChange(event.target.value)}
          disabled={disabled || busy}
          data-slot={`booking-document-title-${index}`}
          data-testid={`${testId}-${index}-title`}
        />
      </div>

      <Attachment
        state={state}
        role="button"
        tabIndex={disabled || busy ? -1 : 0}
        aria-label={file ? `Cambiar archivo ${file.name}` : "Añadir archivo"}
        aria-busy={busy || undefined}
        onClick={() => {
          if (disabled || busy) return;
          inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (disabled || busy) return;
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          inputRef.current?.click();
        }}
        onDragOver={(event) => {
          if (disabled || busy) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget as Node | null;
          if (!next || !event.currentTarget.contains(next)) setDragging(false);
        }}
        onDrop={(event) => {
          if (disabled || busy) return;
          event.preventDefault();
          setDragging(false);
          pushFile(event.dataTransfer?.files?.[0] ?? null);
        }}
        data-slot={`booking-document-attachment-${index}`}
        data-testid={`${testId}-${index}-attachment`}
        className={cn("bo-bookingDocumentAttachment", dragging && "is-dragging", (disabled || busy) && "is-disabled")}
      >
        <AttachmentMedia variant={isImage && previewUrl ? "image" : "icon"} data-testid={`${testId}-${index}-media`}>
          {isImage && previewUrl ? (
            <img src={previewUrl} alt="" data-testid={`${testId}-${index}-preview`} />
          ) : (
            <FileText size={16} strokeWidth={1.8} aria-hidden="true" />
          )}
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle data-testid={`${testId}-${index}-filename`}>
            {file ? file.name : "Arrastra el archivo aquí"}
          </AttachmentTitle>
          <AttachmentDescription data-testid={`${testId}-${index}-description`}>
            {file
              ? `${formatBytes(file.size)} · ${file.type || "tipo desconocido"}`
              : "o haz clic para elegirlo · cualquier formato"}
          </AttachmentDescription>
        </AttachmentContent>
        <AttachmentActions>
          {file && onRemove ? (
            <AttachmentAction
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
              disabled={disabled || busy}
              aria-label="Quitar documento"
              title="Quitar documento"
              data-testid={`${testId}-${index}-remove`}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </AttachmentAction>
          ) : (
            <AttachmentAction
              onClick={(event) => {
                event.stopPropagation();
                inputRef.current?.click();
              }}
              disabled={disabled || busy}
              aria-label="Elegir archivo"
              title="Elegir archivo"
              data-testid={`${testId}-${index}-pick`}
            >
              <Paperclip size={14} strokeWidth={1.8} aria-hidden="true" />
            </AttachmentAction>
          )}
        </AttachmentActions>
        <input
          ref={inputRef}
          type="file"
          tabIndex={-1}
          style={{ display: "none" }}
          onChange={(event) => {
            pushFile(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
          data-slot={`booking-document-file-input-${index}`}
          data-testid={`${testId}-${index}-file-input`}
        />
      </Attachment>
    </div>
  );
}

/** Object URL for the image preview, revoked when the file changes or unmounts. */
function useImagePreviewUrl(file: File | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file || !file.type.startsWith("image/") || typeof URL.createObjectURL !== "function") {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}
