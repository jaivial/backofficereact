import React from "react";
import { Modal } from "../../../../../../../ui/overlays/Modal";
import { CARD_ALLERGENS } from "../../constants";

interface FoodDetailAllergenModalProps {
  open: boolean;
  allergenDraft: string[];
  savingAllergens: boolean;
  onToggleAllergen: (key: string) => void;
  onClose: () => void;
}

export function FoodDetailAllergenModal({
  open,
  allergenDraft,
  savingAllergens,
  onToggleAllergen,
  onClose,
}: FoodDetailAllergenModalProps) {
  return (
    <Modal open={open} title="Alergenos" onClose={onClose} widthPx={620}>
      <div className="bo-modalHead" data-slot="food-detail-allergen-modal-head">
        <div className="bo-modalTitle" data-role="food-detail-allergen-modal-title">Selecciona alergenos</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" data-role="food-detail-allergen-modal-close">
          ×
        </button>
      </div>
      <div className="bo-modalBody" data-slot="food-detail-allergen-modal-body">
        <div className="bo-allergenGrid" data-ui="food-detail-allergen-modal-grid">
          {CARD_ALLERGENS.map((item) => {
            const selected = allergenDraft.includes(item.key);
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                className={`bo-allergenCircle ${selected ? "is-selected" : ""}`}
                onClick={() => void onToggleAllergen(item.key)}
                disabled={savingAllergens}
                data-role="food-detail-allergen-modal-item"
              >
                <span className="bo-allergenCircleIcon" data-role="food-detail-allergen-modal-item-icon"><Icon size={16} /></span>
                <span className="bo-allergenCircleLabel" data-role="food-detail-allergen-modal-item-label">{item.key}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="bo-modalActions" data-slot="food-detail-allergen-modal-actions">
        {savingAllergens ? (
          <span className="bo-panelMeta" data-role="food-detail-allergen-modal-saving">Guardando cambios...</span>
        ) : (
          <span className="bo-panelMeta" data-role="food-detail-allergen-modal-autosaved">Cambios guardados automaticamente.</span>
        )}
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={savingAllergens} data-role="food-detail-allergen-modal-cancel">
          Cancelar
        </button>
      </div>
    </Modal>
  );
}
