/* Forky stand-in for the host attachment chip the registry's PromptBar renders
 * (beautifului.dev `chat-composer-attachment`): a 1:1 square image preview with
 * upload state and remove, or a document tile with its extension label.
 * Kept local so the literal composer needs no host module. Coordination id:
 * FORKY-ADMIN-TOOLS-S01 (forky.admin.composer). */
import { FileText, Image as ImageIcon, Loader2, X } from "lucide-react";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".avif"];

function chatAttachmentKind(name: string, kind?: string | null): "image" | "document" {
  if (kind === "image" || kind === "document") return kind;
  const dot = name.lastIndexOf(".");
  const ext = dot < 0 ? "" : name.slice(dot).toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) ? "image" : "document";
}

function extensionLabel(name: string): string {
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot + 1);
  return (extension && extension.length <= 4 ? extension : "FILE").toUpperCase();
}

export function ComposerAttachmentChip({
  id,
  name,
  kind,
  previewUrl,
  status = "ready",
  error,
  onRemove,
  testIdPrefix,
}: {
  id: string;
  name: string;
  kind?: string | null;
  previewUrl?: string;
  status?: "uploading" | "ready" | "error";
  error?: string;
  onRemove?: () => void;
  testIdPrefix: string;
}) {
  const isImage = chatAttachmentKind(name, kind) === "image";
  return (
    <span
      data-testid={`${testIdPrefix}-wrap-${id}`}
      title={error ?? name}
      className="relative flex size-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900"
    >
      {isImage && previewUrl ? (
        <img
          data-testid={`${testIdPrefix}-preview-${id}`}
          src={previewUrl}
          alt={name}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
        />
      ) : isImage ? (
        <ImageIcon size={18} data-testid={`${testIdPrefix}-icon-${id}`} className="text-zinc-500" />
      ) : (
        <>
          <FileText size={16} data-testid={`${testIdPrefix}-icon-${id}`} className="text-zinc-400" />
          <span data-testid={`${testIdPrefix}-ext-${id}`} className="mt-1 text-[9px] font-semibold uppercase text-zinc-500">
            {extensionLabel(name)}
          </span>
        </>
      )}
      {(status === "uploading" || status === "error") && (
        <span data-testid={`${testIdPrefix}-status-${id}`} className="absolute inset-0 grid place-items-center bg-black/50">
          {status === "uploading" ? (
            <Loader2 size={14} className="animate-spin text-zinc-200" />
          ) : (
            <X size={14} className="text-red-400" strokeWidth={3} />
          )}
        </span>
      )}
      <span data-testid={`${testIdPrefix}-name-${id}`} className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-zinc-200">
        {name}
      </span>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          data-testid={`${testIdPrefix}-remove-${id}`}
          onClick={onRemove}
          className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-black/70 text-zinc-200 transition-colors hover:bg-black"
        >
          <X size={9} strokeWidth={3} />
        </button>
      )}
    </span>
  );
}
