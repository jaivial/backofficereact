import React from "react";
import { Loader2, Plus, Save } from "lucide-react";

import { Select } from "../../../../../../../ui/inputs/Select";
import { Switch } from "../../../../../../../ui/shadcn/Switch";
import { Panel } from "../../../../../../../ui/shell/Panel";

interface FoodDetailQuickEditorProps {
  isPlate: boolean;
  isBebida: boolean;
  savingQuick: boolean;
  quickDirty: boolean;
  quickCanSave: boolean;
  quickName: string;
  quickTitulo: string;
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
  onQuickNameChange: (value: string) => void;
  onQuickTituloChange: (value: string) => void;
  onQuickTipoChange: (value: string) => void;
  onQuickPrecioChange: (value: string) => void;
  onQuickSuplementoChange: (value: string) => void;
  onQuickHasSuplementoChange: (value: boolean) => void;
  onQuickCategoriaChange: (value: string) => void;
  onQuickDescripcionChange: (value: string) => void;
  onQuickActiveChange: (value: boolean) => void;
  onQuickSave: () => void;
  onAddCategoryClick: () => void;
}

export function FoodDetailQuickEditor({
  isPlate,
  isBebida,
  savingQuick,
  quickDirty,
  quickCanSave,
  quickName,
  quickTitulo,
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
  onQuickTituloChange,
  onQuickTipoChange,
  onQuickPrecioChange,
  onQuickSuplementoChange,
  onQuickHasSuplementoChange,
  onQuickCategoriaChange,
  onQuickDescripcionChange,
  onQuickActiveChange,
  onQuickSave,
  onAddCategoryClick,
}: FoodDetailQuickEditorProps) {
  return (
    <Panel
      className="bo-foodDetailPanel bo-foodDetailQuickEditor"
      headClassName="bo-foodDetailQuickHead"
      title="Edicion rapida"
      meta="Atajos para ajustar este plato sin volver al listado."
      actions={
        <span className={`bo-badge bo-badge--sm ${quickDirty ? "bo-badge--warning" : "bo-badge--muted"}`} data-role="food-detail-quick-dirty-badge">
          {quickDirty ? "Cambios sin guardar" : "Sin cambios"}
        </span>
      }
      data-ui="food-detail-quick-editor"
    >
      <div data-slot="food-detail-quick-body">
        <div className="bo-foodDetailQuickGrid" data-ui="food-detail-quick-grid">
          <label className="bo-field" data-slot="food-detail-quick-name-field">
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
          <label className="bo-field" data-slot="food-detail-quick-titulo-field">
            <span className="bo-label" data-role="food-detail-quick-titulo-label">Titulo</span>
            <input
              type="text"
              className="bo-input"
              value={quickTitulo}
              onChange={(e) => onQuickTituloChange(e.target.value)}
              disabled={savingQuick}
              data-role="food-detail-quick-titulo-input"
            />
          </label>
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
          ) : null}
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
          <label className="bo-field" data-slot="food-detail-quick-categoria-field">
            <div className="flex items-center gap-2 mb-2" data-slot="foodDetailQuickEditor-mb-2">
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
                <span className="bo-label" data-role="food-detail-quick-supplement-amount-label">Importe suplemento</span>
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
          <div className="bo-foodDetailQuickStatus" data-ui="food-detail-quick-active">
            <span className="bo-label" data-role="food-detail-quick-active-label">Visible en carta</span>
            <Switch checked={quickActive} onCheckedChange={onQuickActiveChange} disabled={savingQuick} aria-label="Cambiar visibilidad del plato" />
          </div>
          <label className="bo-field bo-foodDetailQuickDescription" data-slot="food-detail-quick-description-field">
            <span className="bo-label" data-role="food-detail-quick-description-label">Descripcion</span>
            <textarea
              className="bo-textarea"
              rows={4}
              value={quickDescripcion}
              onChange={(e) => onQuickDescripcionChange(e.target.value)}
              disabled={savingQuick}
              data-role="food-detail-quick-description-textarea"
            />
          </label>
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
          {savingQuick ? <Loader2 size={14} className="bo-foodDetailSpinIcon" /> : <Save size={14} />}
        </button>
      </div>
    </Panel>
  );
}
