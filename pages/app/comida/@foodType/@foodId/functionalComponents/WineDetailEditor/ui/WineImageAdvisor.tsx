import React, { useCallback, useRef, useState, type RefObject } from "react";
import { Eraser, ImagePlus, Loader2, Sparkles, Upload, X } from "lucide-react";

type WineImageAdvisorProps = {
  imageUrl: string | null;
  uploading: boolean;
  generating: boolean;
  disabled?: boolean;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => Promise<string | null>;
  onGenerateAI: (file: File) => Promise<boolean>;
  onCutout: (file: File) => Promise<string | null>;
};

export function WineImageAdvisor({
  imageUrl,
  uploading,
  generating,
  disabled,
  fileInputRef: externalInputRef,
  onUpload,
  onGenerateAI,
  onCutout,
}: WineImageAdvisorProps) {
  const internalInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = externalInputRef ?? internalInputRef;
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cutting, setCutting] = useState(false);
  const [cutoutError, setCutoutError] = useState<string | null>(null);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setAdvisorOpen(true);
  }, []);

  // Coordination id: wine_image_cutout_v2 - the backend removes the
  // background (WaveSpeed API) and crops to the object, then saves it.
  const handleCutout = useCallback(async () => {
    if (!selectedFile) return;
    setCutting(true);
    setCutoutError(null);
    try {
      const url = await onCutout(selectedFile);
      if (url) closeAdvisor();
      else setCutoutError("No se pudo quitar el fondo");
    } finally {
      setCutting(false);
    }
  }, [selectedFile, onCutout]);

  const handleUploadOnly = useCallback(async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile);
    closeAdvisor();
  }, [selectedFile, onUpload]);

  const handleImproveWithAI = useCallback(async () => {
    if (!selectedFile) return;
    await onGenerateAI(selectedFile);
    closeAdvisor();
  }, [selectedFile, onGenerateAI]);

  const closeAdvisor = useCallback(() => {
    setAdvisorOpen(false);
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setCutoutError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [previewUrl]);

  const busy = uploading || generating || cutting;

  return (
    <div data-ui="wine-image-advisor" className="flex flex-col items-center">
      <div
        data-role="wine-image-preview"
        className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-[var(--bo-surface-2)] border border-[var(--bo-border)]"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Imagen del vino"
            data-role="wine-image-img"
            className="w-full h-full object-contain"
          />
        ) : (
          <div data-role="wine-image-placeholder" className="w-full h-full flex flex-col items-center justify-center gap-2 text-[var(--bo-muted)]">
            <ImagePlus size={32} data-slot="wine-image-placeholder-icon" />
            <span data-slot="wine-image-placeholder-text" className="text-xs">Sin imagen</span>
          </div>
        )}
        {busy && (
          <div
            data-role="wine-image-loading-overlay"
            className="absolute inset-0 bg-[var(--bo-surface)]/70 flex items-center justify-center"
          >
            <Loader2 size={28} className="animate-spin text-[var(--bo-accent)]" data-slot="wine-image-spinner" />
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        data-role="wine-image-file-input"
        disabled={disabled || busy}
      />

      {advisorOpen && previewUrl && (
        <div
          data-role="wine-image-advisor-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={(e) => { if (e.target === e.currentTarget) closeAdvisor(); }}
        >
          <div
            data-ui="wine-image-advisor-content"
            className="bg-[var(--bo-surface)] rounded-2xl border border-[var(--bo-border)] shadow-xl max-w-md w-full mx-4 overflow-hidden"
          >
            <div data-slot="wine-image-advisor-header" className="flex items-center justify-between p-4 border-b border-[var(--bo-border)]">
              <span data-role="wine-image-advisor-title" className="text-sm font-semibold text-[var(--bo-text)]">
                Imagen del vino
              </span>
              <button
                type="button"
                onClick={closeAdvisor}
                data-role="wine-image-advisor-close"
                className="p-1 rounded-lg hover:bg-[var(--bo-surface-2)] transition-colors duration-150"
              >
                <X size={16} className="text-[var(--bo-muted)]" data-role="wine-image-advisor-close-icon" />
              </button>
            </div>

            <div data-slot="wine-image-advisor-preview" className="p-4">
              <img
                src={previewUrl}
                alt="Vista previa"
                data-role="wine-image-advisor-preview-img"
                className="w-full aspect-square object-contain rounded-xl bg-[repeating-conic-gradient(var(--bo-surface-2)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
              />
              <button
                type="button"
                onClick={handleCutout}
                disabled={busy}
                data-role="wine-image-advisor-cutout-btn"
                data-testid="wine-image-advisor-cutout-btn"
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  bg-[var(--bo-surface-2)] text-[var(--bo-text)] border border-[var(--bo-border)]
                  hover:bg-[var(--bo-surface-3)] transition-colors duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cutting ? (
                  <Loader2 size={14} className="animate-spin" data-slot="wine-image-cutout-spinner" data-testid="wine-image-advisor-cutout-spinner" />
                ) : (
                  <Eraser size={14} data-slot="wine-image-cutout-icon" data-testid="wine-image-advisor-cutout-icon" />
                )}
                {cutting ? "Quitando fondo..." : "Quitar fondo y recortar"}
              </button>
              {cutoutError ? (
                <p data-role="wine-image-advisor-cutout-error" data-testid="wine-image-advisor-cutout-error" className="mt-2 text-xs text-[var(--bo-danger,#ef4444)]">
                  {cutoutError}
                </p>
              ) : null}
            </div>

            <div data-slot="wine-image-advisor-actions" className="flex gap-3 p-4 border-t border-[var(--bo-border)]">
              <button
                type="button"
                onClick={handleUploadOnly}
                disabled={busy}
                data-role="wine-image-advisor-upload-btn"
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
                onClick={handleImproveWithAI}
                disabled={busy}
                data-role="wine-image-advisor-ai-btn"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                  bg-[var(--bo-accent)] text-white
                  hover:opacity-90 transition-opacity duration-150
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <Loader2 size={14} className="animate-spin" data-slot="ai-spinner" />
                ) : (
                  <Sparkles size={14} data-slot="ai-icon" />
                )}
                {generating ? "Generando..." : "Mejorar con AI"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
