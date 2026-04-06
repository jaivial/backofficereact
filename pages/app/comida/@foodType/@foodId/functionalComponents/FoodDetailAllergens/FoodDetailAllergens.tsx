import React from "react";
import { Plus, X } from "lucide-react";

interface FoodDetailAllergensProps {
  allergenList: string[];
  supportsQuickEditor: boolean;
  savingAllergens: boolean;
  onOpenAllergenModal: () => void;
  onToggleAllergen: (key: string) => void;
}

export function FoodDetailAllergens({
  allergenList,
  supportsQuickEditor,
  savingAllergens,
  onOpenAllergenModal,
  onToggleAllergen,
}: FoodDetailAllergensProps) {
  return (
    <div className="bo-panel bo-foodDetailPanel bo-foodDetailPanel--allergens" data-ui="food-detail-allergens-panel">
      <div className="bo-panelHead bo-foodDetailAllergenHead" data-slot="food-detail-allergens-head">
        <div data-slot="food-detail-allergens-title-wrap">
          <div className="bo-panelTitle" data-role="food-detail-allergens-title">Alergenos</div>
          <div className="bo-panelMeta" data-role="food-detail-allergens-meta">Etiquetas usadas para informacion alergena del plato.</div>
        </div>
        {supportsQuickEditor ? (
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onOpenAllergenModal} data-role="food-detail-allergens-edit-btn">
            <Plus size={14} />
            Añadir
          </button>
        ) : null}
      </div>
      <div className="bo-panelBody" data-slot="food-detail-allergens-body">
        {allergenList.length > 0 ? (
          <div className="bo-tagsList bo-foodDetailTags" data-ui="food-detail-allergens-tags">
            {allergenList.map((alergeno) => (
              <span key={alergeno} className="bo-tagItem bo-foodDetailTag bo-foodDetailTag--removable" data-role="food-detail-allergen-tag">
                <span data-role="food-detail-allergen-tag-text">{alergeno}</span>
                {supportsQuickEditor && (
                  <button
                    type="button"
                    className="bo-tagItemRemove"
                    onClick={() => void onToggleAllergen(alergeno)}
                    aria-label={`Eliminar ${alergeno}`}
                    disabled={savingAllergens}
                    data-role="food-detail-allergen-tag-remove"
                  >
                    <X size={12} />
                  </button>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="bo-foodDetailEmptyNote" data-role="food-detail-allergens-empty">Sin alergenos</div>
        )}
      </div>
    </div>
  );
}
