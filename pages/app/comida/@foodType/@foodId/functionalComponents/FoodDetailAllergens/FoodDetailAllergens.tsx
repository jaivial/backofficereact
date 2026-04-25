import React from "react";
import { Plus, X } from "lucide-react";
import { Panel } from "../../../../../../../ui/shell/Panel";

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
    <Panel
      className="bo-foodDetailPanel bo-foodDetailPanel--allergens"
      headClassName="bo-foodDetailAllergenHead"
      title="Alergenos"
      meta="Etiquetas usadas para informacion alergena del plato."
      actions={supportsQuickEditor ? (
        <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onOpenAllergenModal} data-role="food-detail-allergens-edit-btn">
          <Plus size={14} />
          Añadir
        </button>
      ) : undefined}
      data-ui="food-detail-allergens-panel"
    >
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
    </Panel>
  );
}
