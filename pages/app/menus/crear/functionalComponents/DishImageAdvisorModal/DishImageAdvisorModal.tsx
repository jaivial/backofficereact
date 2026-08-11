import React from "react";
import { Sparkles } from "lucide-react";
import { Modal } from "../../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../../ui/overlays/ModalHeader";

export function DishImageAdvisorModalComponent({
  open,
  imageUrl,
  imageKB,
  busy,
  subjectLabel,
  onClose,
  onContinueWithoutAI,
  onImproveWithAI,
}: {
  open: boolean;
  imageUrl: string;
  imageKB: number;
  busy: boolean;
  subjectLabel?: string;
  onClose: () => void;
  onContinueWithoutAI: () => void;
  onImproveWithAI: () => void;
}) {
  const label = subjectLabel || "plato";
  return (
    <Modal open={open} title="Asesor IA de imagen" onClose={busy ? () => undefined : onClose} widthPx={620} hideClose>
      <ModalHeader title="Asesor IA de imagen" onClose={busy ? () => undefined : onClose} />
      <div className="bo-modalBody bo-dishAIAdvisorBody" data-slot="dishImageAdvisorModal-dishAIAdvisorBody">
        <div className="bo-dishAIAdvisorCopy" data-slot="dishImageAdvisorModal-dishAIAdvisorCopy">
          <p className="bo-dishAIAdvisorLead" data-slot="dishImageAdvisorModal-dishAIAdvisorLead">
            Mejorar esta foto con IA puede elevar la presentacion de {label} y hacer tu menu mas atractivo para el cliente.
          </p>
          <p className="bo-dishAIAdvisorHint" data-slot="dishImageAdvisorModal-dishAIAdvisorHint">Imagen optimizada para subir: {Math.max(1, imageKB)}KB · WebP.</p>
        </div>
        <div className="bo-dishAIAdvisorPreviewWrap" data-slot="dishImageAdvisorModal-dishAIAdvisorPreviewWrap">
          <img className="bo-dishAIAdvisorPreview" src={imageUrl} alt="Previsualizacion de imagen optimizada" />
        </div>
      </div>
      <div className="bo-modalActions bo-dishAIAdvisorActions" data-slot="dishImageAdvisorModal-dishAIAdvisorActions">
        <button className="bo-btn bo-btn--advisorSecondary" type="button" onClick={onContinueWithoutAI} disabled={busy} data-testid="dish-advisor-continue-without-ai">
          Continuar sin mejorar
        </button>
        <button className="bo-btn bo-btn--advisorPrimary" type="button" onClick={onImproveWithAI} disabled={busy} aria-label={busy ? "Mejorando con IA" : "Mejorar con IA"} data-testid="dish-advisor-improve-with-ai">
          <Sparkles size={15} />
          <span data-slot="dishImageAdvisorModal-con">{busy ? "Mejorando con IA..." : "Mejorar con IA"}</span>
        </button>
      </div>
    </Modal>
  );
}
