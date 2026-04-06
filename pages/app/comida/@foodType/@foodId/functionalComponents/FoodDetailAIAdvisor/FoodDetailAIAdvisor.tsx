import React from "react";
import { Loader2, Upload, X } from "lucide-react";

interface FoodDetailAIAdvisorProps {
  show: boolean;
  imagePreview: string | null;
  aiBusy: boolean;
  onClose: () => void;
  onContinueWithout: () => void;
  onEnhance: () => void;
}

export function FoodDetailAIAdvisor({
  show,
  imagePreview,
  aiBusy,
  onClose,
  onContinueWithout,
  onEnhance,
}: FoodDetailAIAdvisorProps) {
  if (!show || !imagePreview) return null;

  return (
    <div
      data-role="food-detail-ai-advisor-overlay"
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        data-ui="food-detail-ai-advisor-content"
        className="bg-[var(--bo-surface)] rounded-2xl border border-[var(--bo-border)] shadow-xl max-w-md w-full mx-4 overflow-hidden"
      >
        <div data-slot="food-detail-ai-advisor-header" className="flex items-center justify-between p-4 border-b border-[var(--bo-border)]">
          <span data-role="food-detail-ai-advisor-title" className="text-sm font-semibold text-[var(--bo-text)]">
            Asesor IA de imagen
          </span>
          <button
            type="button"
            onClick={onClose}
            data-role="food-detail-ai-advisor-close"
            className="p-1 rounded-lg hover:bg-[var(--bo-surface-2)] transition-colors duration-150"
            disabled={aiBusy}
          >
            <X size={16} className="text-[var(--bo-muted)]" data-role="food-detail-ai-advisor-close-icon" />
          </button>
        </div>

        <div data-slot="food-detail-ai-advisor-preview" className="p-4">
          <img
            src={imagePreview}
            alt="Vista previa"
            data-role="food-detail-ai-advisor-preview-img"
            className="w-full aspect-square object-cover rounded-xl"
          />
        </div>

        <div data-slot="food-detail-ai-advisor-actions" className="flex gap-3 p-4 border-t border-[var(--bo-border)]">
          <button
            type="button"
            onClick={onContinueWithout}
            disabled={aiBusy}
            data-role="food-detail-ai-advisor-without-btn"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-[var(--bo-surface-2)] text-[var(--bo-text)] border border-[var(--bo-border)]
              hover:bg-[var(--bo-surface-3)] transition-colors duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={14} data-slot="upload-icon" />
            Continuar sin mejorar
          </button>
          <button
            type="button"
            onClick={onEnhance}
            disabled={aiBusy}
            data-role="food-detail-ai-advisor-enhance-btn"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
              bg-purple-950/40 border-white/20 border-solid !border-[0.5px] hover:bg-purple-500/20 hover:cursor-pointer text-white
              hover:opacity-90 transition-opacity duration-150
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiBusy ? (
              <Loader2 size={14} className="animate-spin" data-slot="ai-spinner" />
            ) : (
              "Mejorar con IA"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
