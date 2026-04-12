import React, { useCallback } from "react";
import { Loader2, Sparkles, Upload, X } from "lucide-react";
import { cn } from "../shadcn/utils";

interface ImageAdvisorOverlayProps {
  open: boolean;
  previewUrl: string | null;
  busy: boolean;
  title?: string;
  disableAI?: boolean;
  disableAIReason?: string;
  className?: string;
  onUploadPlain: () => void;
  onEnhanceAI: () => void;
  onClose: () => void;
}

export function ImageAdvisorOverlay({
  open,
  previewUrl,
  busy,
  title = "Imagen",
  disableAI,
  disableAIReason = "Guarda el elemento primero para usar AI",
  className,
  onUploadPlain,
  onEnhanceAI,
  onClose,
}: ImageAdvisorOverlayProps) {
  const handleBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!open || !previewUrl) return null;

  return (
    <div
      data-role="image-advisor-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleBackdrop}
    >
      <div
        data-ui="image-advisor-content"
        className={cn("bg-[var(--bo-surface)] rounded-2xl border border-[var(--bo-border)] shadow-xl max-w-md w-full mx-4 overflow-hidden", className)}
      >
        <div data-slot="image-advisor-header" className="flex items-center justify-between p-4 border-b border-[var(--bo-border)]">
          <span data-role="image-advisor-title" className="text-sm font-semibold text-[var(--bo-text)]">
            {title}
          </span>
          <button
            type="button"
            onClick={onClose}
            data-role="image-advisor-close"
            className="p-1 rounded-lg hover:bg-[var(--bo-surface-2)] transition-colors duration-150"
          >
            <X size={16} className="text-[var(--bo-muted)]" data-role="image-advisor-close-icon" />
          </button>
        </div>

        <div data-slot="image-advisor-preview" className="p-4">
          <img
            src={previewUrl}
            alt="Vista previa"
            data-role="image-advisor-preview-img"
            className="w-full aspect-square object-cover rounded-xl"
          />
        </div>

        <div data-slot="image-advisor-actions" className="flex gap-3 p-4 border-t border-[var(--bo-border)]">
          <button
            type="button"
            onClick={onUploadPlain}
            disabled={busy}
            data-role="image-advisor-upload-btn"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-[var(--bo-surface-2)] text-[var(--bo-text)] border border-[var(--bo-border)]
              hover:bg-[var(--bo-surface-3)] transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} data-slot="upload-icon" />
            Subir sin AI
          </button>
          <button
            type="button"
            onClick={onEnhanceAI}
            disabled={busy || disableAI}
            title={disableAI ? disableAIReason : undefined}
            data-role="image-advisor-ai-btn"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-[var(--bo-accent)] text-white
              hover:opacity-90 transition-opacity duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (
              <Loader2 size={14} className="animate-spin" data-slot="ai-spinner" />
            ) : (
              <Sparkles size={14} data-slot="ai-icon" />
            )}
            {busy ? "Generando..." : "Mejorar con AI"}
          </button>
        </div>
      </div>
    </div>
  );
}
