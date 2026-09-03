import { type ProductionType } from "../../../../_components/TechnicalSheet/ProductionTypeToggle";
import { ProductionTypeSection } from "../../../../_components/TechnicalSheet/ProductionTypeSection";
import React, { useEffect, useState } from "react";
import { Loader2, Plus, Save, X } from "lucide-react";

import { Select } from "../../../../../../../ui/inputs/Select";
import { Switch } from "../../../../../../../ui/shadcn/Switch";
import { Panel } from "../../../../../../../ui/shell/Panel";
import { FOOD_TYPE_ICONS, CARD_ALLERGENS } from "../../constants";

function DescripcionToggle({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  const [show, setShow] = useState(value.length > 0);
  return (
    <div className="bo-foodDetailQuickDescription" data-slot="food-detail-quick-description-field">
      <div data-slot="foodDetailQuickEditor-mb-2" className="flex items-center justify-between mb-2">
        <span className="bo-label" data-role="food-detail-quick-description-label">Descripcion</span>
        <Switch
          checked={show}
          onCheckedChange={(v) => {
            setShow(v);
            if (!v) onChange("");
          }}
          disabled={disabled}
          aria-label="Mostrar descripcion"
        />
      </div>
      {show ? (
        <textarea
          className="bo-textarea"
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          data-role="food-detail-quick-description-textarea"
        />
      ) : null}
    </div>
  );
}

interface FoodDetailQuickEditorProps {
  isPlate: boolean;
  isBebida: boolean;
  savingQuick: boolean;
  quickCanSave: boolean;
  quickName: string;
  quickTipo: string;
  quickPrecio: string;
  quickSuplemento: string;
  quickHasSuplemento: boolean;
  quickCategoria: string;
  quickDescripcion: string;
  quickActive: boolean;
  categoriesLoading: boolean;
  quickTipoOptions: Array<{ value: string; label: string }>;
  quickCategorySelectOptions: Array<{ value: string; label: string }>;
  allergenList: string[];
  savingAllergens: boolean;
  onOpenAllergenModal: () => void;
  onToggleAllergen: (key: string) => void;
  onQuickNameChange: (value: string) => void;
  onQuickTipoChange: (value: string) => void;
  onQuickPrecioChange: (value: string) => void;
  onQuickSuplementoChange: (value: string) => void;
  onQuickHasSuplementoChange: (value: boolean) => void;
  onQuickCategoriaChange: (value: string) => void;
  onQuickDescripcionChange: (value: string) => void;
  onQuickActiveChange: (value: boolean) => void;
  onQuickSave: () => void;
  onAddCategoryClick: () => void;
  /** Null for a dish that has not been saved yet: there is nothing to link to. */
  itemId?: number | null;
  productionType?: ProductionType;
  stockRecipeId?: number | null;
  /** Which catalogue table the id belongs to; postres are a separate table. */
  source?: "comida" | "postres";
}

export function FoodDetailQuickEditor({
  isPlate,
  isBebida,
  savingQuick,
  quickCanSave,
  quickName,
  quickTipo,
  quickPrecio,
  quickSuplemento,
  quickHasSuplemento,
  quickCategoria,
  quickDescripcion,
  quickActive,
  categoriesLoading,
  quickTipoOptions,
  quickCategorySelectOptions,
  onQuickNameChange,
  onQuickTipoChange,
  onQuickPrecioChange,
  onQuickSuplementoChange,
  onQuickHasSuplementoChange,
  onQuickCategoriaChange,
  onQuickDescripcionChange,
  onQuickActiveChange,
  allergenList,
  savingAllergens,
  onOpenAllergenModal,
  onToggleAllergen,
  onQuickSave,
  onAddCategoryClick,
  itemId = null,
  productionType = "RAW",
  stockRecipeId = null,
  source = "comida",
}: FoodDetailQuickEditorProps) {
  // The sheet link lives on the saved dish, so it is tracked locally and
  // seeded from the server value rather than from the in-progress form.
  const [currentProductionType, setCurrentProductionType] = useState<ProductionType>(productionType);
  const [currentRecipeId, setCurrentRecipeId] = useState<number | null>(stockRecipeId);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [sheetEditorOpen, setSheetEditorOpen] = useState(false);

  // Re-seed only when a DIFFERENT product is opened; see WineDetailEditor for
  // why re-seeding on every prop change would revert a save.
  useEffect(() => {
    setCurrentProductionType(productionType);
    setCurrentRecipeId(stockRecipeId);
  }, [itemId]);

  return (
    <>
    <Panel
      className="bo-foodDetailPanel bo-foodDetailQuickEditor"
      actions={<span className="bo-badge bo-badge--sm bo-badge--muted bo-hidden" />}
      data-ui="food-detail-quick-editor"
    >
      <div data-slot="food-detail-quick-body">
        <div className="bo-foodDetailQuickGrid" data-ui="food-detail-quick-grid">
          <label className="bo-field bo-field--full" data-slot="food-detail-quick-name-field">
            <span className="bo-label" data-role="food-detail-quick-name-label">Nombre</span>
            <input
              type="text"
              className="bo-input"
              value={quickName}
              onChange={(e) => onQuickNameChange(e.target.value)}
              disabled={savingQuick}
              data-role="food-detail-quick-name-input"
            />
          </label>

          {/* Row: tipo + categoria */}
          {isPlate ? (
            <label className="bo-field" data-slot="food-detail-quick-tipo-field">
              <span className="bo-label" data-role="food-detail-quick-tipo-label">Tipo</span>
              <Select
                value={quickTipo}
                onChange={onQuickTipoChange}
                options={quickTipoOptions}
                className="bo-foodDetailSelect"
                ariaLabel="Tipo del plato"
                disabled={savingQuick}
              />
            </label>
          ) : <div />}
          <label className="bo-field" data-slot="food-detail-quick-categoria-field">
            <div className="flex items-center gap-2" data-slot="foodDetailQuickEditor-mb-2">
              <span className="bo-label" data-role="food-detail-quick-categoria-label">Categoria</span>
              {isBebida ? (
                <button
                  data-role="food-detail-add-category-btn"
                  type="button"
                  className="bo-btn bo-btn--ghost bo-btn--sm"
                  onClick={onAddCategoryClick}
                >
                  <Plus size={14} />
                  Añadir categoria
                </button>
              ) : null}
            </div>
            <Select
              value={quickCategoria}
              onChange={onQuickCategoriaChange}
              options={quickCategorySelectOptions}
              className="bo-foodDetailSelect"
              ariaLabel="Categoria del plato"
              disabled={savingQuick || categoriesLoading}
            />
          </label>

          {/* Row: precio + suplemento toggle */}
          <label className="bo-field" data-slot="food-detail-quick-precio-field">
            <span className="bo-label" data-role="food-detail-quick-precio-label">Precio</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="bo-input"
              value={quickPrecio}
              onChange={(e) => onQuickPrecioChange(e.target.value)}
              disabled={savingQuick}
              data-role="food-detail-quick-precio-input"
            />
          </label>
          <div className={`bo-foodDetailQuickStatus bo-foodDetailQuickSupplement${quickHasSuplemento ? " is-active" : ""}`} data-ui="food-detail-quick-supplement">
            <div className="bo-foodDetailQuickStatusRow" data-ui="food-detail-quick-supplement-row">
              <span className="bo-label" data-role="food-detail-quick-supplement-label">Tiene suplemento</span>
              <Switch
                checked={quickHasSuplemento}
                onCheckedChange={onQuickHasSuplementoChange}
                disabled={savingQuick}
                aria-label="Activar suplemento"
              />
            </div>
            {quickHasSuplemento ? (
              <label className="bo-field bo-foodDetailQuickSupplementField" data-slot="food-detail-quick-supplement-field">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="bo-input"
                  value={quickSuplemento}
                  onChange={(e) => onQuickSuplementoChange(e.target.value)}
                  disabled={savingQuick}
                  data-role="food-detail-quick-suplement-input"
                />
              </label>
            ) : null}
          </div>

          {/* Ficha tecnica: what the dish is made of, and its cost. Only a
              saved dish can carry one, because the sheet links to its id. */}
          <ProductionTypeSection
            itemId={itemId}
            productionType={currentProductionType}
            stockRecipeId={currentRecipeId}
            productName={quickName}
            source={source}
            onChange={(next) => {
              setCurrentProductionType(next);
              // Reverting to raw clears the link server-side, so the local copy
              // follows to avoid offering a sheet that is no longer attached.
              if (next === "RAW") setCurrentRecipeId(null);
            }}
            onSheetLinked={(sheetId) => {
              setCurrentRecipeId(sheetId);
              setCurrentProductionType("MANUFACTURED");
            }}
          />

          {/* Visible en carta — full width */}
          <div className="bo-foodDetailQuickStatus bo-foodDetailQuickStatus--full" data-ui="food-detail-quick-active">
            <span className="bo-label" data-role="food-detail-quick-active-label">Visible en carta</span>
            <Switch checked={quickActive} onCheckedChange={onQuickActiveChange} disabled={savingQuick} aria-label="Cambiar visibilidad del plato" />
          </div>

          {/* Alergenos — inline tags, inside form */}
          <div className="bo-foodDetailQuickAlergenos" data-slot="food-detail-quick-alergenos">
            <div data-slot="foodDetailQuickEditor-gap-4" className="flex items-center justify-start gap-4">
              <span className="bo-label" data-role="food-detail-quick-alergenos-label">Alergenos</span>
              <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onOpenAllergenModal} data-role="food-detail-allergens-edit-btn">
                <Plus size={14} />
                Añadir
              </button>
            </div>
            {allergenList.length > 0 ? (
              <div className="bo-tagsList bo-foodDetailTags" data-ui="food-detail-allergens-tags">
                {allergenList.map((alergeno) => (
                  <span key={alergeno} className="bo-tagItem bo-foodDetailTag bo-foodDetailTag--removable" data-role="food-detail-allergen-tag">
                    {(() => {
                      const entry = CARD_ALLERGENS.find(a => a.key === alergeno);
                      const Icon = entry?.icon;
                      return Icon ? <span className="bo-allergenCircleIcon"><Icon size={14} /></span> : null;
                    })()}
                    <span data-role="food-detail-allergen-tag-text">{alergeno}</span>
                    <button
                      type="button"
                      className="bo-tagItemRemove"
                      onClick={() => onToggleAllergen(alergeno)}
                      aria-label={`Eliminar ${alergeno}`}
                      disabled={savingAllergens}
                      data-role="food-detail-allergen-tag-remove"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="bo-foodDetailEmptyNote" data-role="food-detail-allergens-empty">Sin alergenos</div>
            )}
          </div>

          {/* Descripcion — full width with toggle */}
          <DescripcionToggle
            value={quickDescripcion}
            onChange={onQuickDescripcionChange}
            disabled={savingQuick}
          />
        </div>
      </div>
      <div className="bo-foodDetailEditorActions" data-slot="food-detail-quick-actions">
        <button
          className="bo-btn bo-btn--primary"
          type="button"
          onClick={onQuickSave}
          disabled={!quickCanSave}
          aria-label="Guardar cambios"
          title="Guardar cambios"
          data-role="food-detail-quick-save-btn"
        >
          {savingQuick ? <><Loader2 size={14} className="bo-foodDetailSpinIcon" /> Guardando</> : <><Save size={14} /> Guardar</>}
        </button>
      </div>
    </Panel>


    </>
  );
}
