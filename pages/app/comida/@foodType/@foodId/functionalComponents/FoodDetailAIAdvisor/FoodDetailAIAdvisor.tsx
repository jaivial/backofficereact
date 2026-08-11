import React from "react";
import { Loader2, Upload } from "lucide-react";

import { Modal } from "../../../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../../../ui/overlays/ModalHeader";

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
  const open = show && !!imagePreview;

  return (
    <Modal open={open} title="Asesor IA de imagen" onClose={onClose} widthPx={460} hideClose>
      <ModalHeader
        title="Asesor IA de imagen"
        onClose={onClose}
        data-slot="food-detail-ai-advisor-header"
        data-role="food-detail-ai-advisor-title"
      />
      <div className="bo-modalBody" data-slot="food-detail-ai-advisor-preview" data-ui="food-detail-ai-advisor-content">
        {imagePreview ? (
          <img
            src={imagePreview}
            alt="Vista previa"
            data-role="food-detail-ai-advisor-preview-img"
            className="w-full aspect-square object-cover rounded-xl"
          />
        ) : null}
      </div>
      <div className="bo-modalActions" data-slot="food-detail-ai-advisor-actions">
        <button
          type="button"
          onClick={onContinueWithout}
          disabled={aiBusy}
          data-role="food-detail-ai-advisor-without-btn"
          className="bo-btn bo-btn--ghost gap-2"
        >
          <Upload size={14} data-slot="upload-icon" />
          Continuar sin mejorar
        </button>
        <button
          type="button"
          onClick={onEnhance}
          disabled={aiBusy}
          data-role="food-detail-ai-advisor-enhance-btn"
          className="bo-btn bo-btn--primary gap-2"
        >
          {aiBusy ? (
            <Loader2 size={14} className="animate-spin" data-slot="ai-spinner" />
          ) : (
            "Mejorar con IA"
          )}
        </button>
      </div>
    </Modal>
  );
}
