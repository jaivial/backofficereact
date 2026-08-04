import { type ProductionType } from "../../../../_components/TechnicalSheet/ProductionTypeToggle";
import { ProductionTypeSection } from "../../../../_components/TechnicalSheet/ProductionTypeSection";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Upload, Wine } from "lucide-react";

import { Select } from "../../../../../../../ui/inputs/Select";
import { Switch } from "../../../../../../../ui/shadcn/Switch";
import { Panel } from "../../../../../../../ui/shell/Panel";
import { Breadcrumbs } from "../../../../../../../ui/nav/Breadcrumbs";
import type { BreadcrumbItem } from "../../../../../../../ui/nav/Breadcrumbs";
import { FOOD_TYPE_LABELS } from "../../../../_components/foodTypes";
import { useBreadcrumbFadeout } from "../../../../_components/hooks/useBreadcrumbFadeout";
import type { WineDetailEditorProps } from "./types";
import { WINE_TIPO_OPTIONS } from "./constants";
import { useWineForm } from "./hooks/useWineForm";
import { useWineImage } from "./hooks/useWineImage";
import { useWineAIWebSocket } from "./hooks/useWineAIWebSocket";
import { WineImageAdvisor } from "./ui/WineImageAdvisor";

export function WineDetailEditor({ vino, isNew, onSave }: WineDetailEditorProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fade-out before breadcrumb navigation
  useBreadcrumbFadeout(sectionRef);
  const { form, saving, canSave, createdId, setField, save } = useWineForm(vino, isNew);
  const {
    uploading,
    generating,
    imageUrl,
    uploadImage,
    uploadImageAI,
    updateFromWS,
    setGeneratingFromWS,
  } = useWineImage(vino);
  const busy = uploading || generating;

  // Wine keeps its own copy of the stock link so the toggle can update without
  // waiting for a full page reload.
  const [productionType, setProductionType] = useState<ProductionType>(
    vino?.production_type === "MANUFACTURED" ? "MANUFACTURED" : "RAW",
  );
  const [stockRecipeId, setStockRecipeId] = useState<number | null>(vino?.stock_recipe_id ?? null);
  const [sheetPickerOpen, setSheetPickerOpen] = useState(false);
  const [sheetEditorOpen, setSheetEditorOpen] = useState(false);

  // Re-seed only when a DIFFERENT wine is opened. Re-seeding on every change of
  // the prop would undo a save the user just made: the page keeps its own copy
  // of the wine and does not refetch after this write, so the stale prop would
  // overwrite the confirmed new value.
  useEffect(() => {
    setProductionType(vino?.production_type === "MANUFACTURED" ? "MANUFACTURED" : "RAW");
    setStockRecipeId(vino?.stock_recipe_id ?? null);
  }, [vino?.num]);

  useWineAIWebSocket({
    wineNum: vino?.num ?? null,
    onEvent: useCallback(
      (msg: { type: string; wine_num?: number; ai_generated_img?: string | null; foto_url?: string }) => {
        if (!vino || msg.wine_num !== vino.num) return;
        if (msg.type === "wine_ai_completed") {
          updateFromWS({ ai_generated_img: msg.ai_generated_img, foto_url: msg.foto_url });
        } else if (msg.type === "wine_ai_started") {
          setGeneratingFromWS(true);
        } else if (msg.type === "wine_ai_failed") {
          setGeneratingFromWS(false);
        }
      },
      [vino, updateFromWS, setGeneratingFromWS],
    ),
  });

  const onInternalSave = useCallback(async () => {
    const saved = await save();
    if (saved) onSave(saved);
  }, [onSave, save]);

  React.useEffect(() => {
    if (createdId) {
      window.location.assign(`/app/comida/vinos/${createdId}`);
    }
  }, [createdId]);

  const tipoSelectOptions = useMemo(
    () => [...WINE_TIPO_OPTIONS.map((o) => ({ value: o.value, label: o.label }))],
    [],
  );

  const foodTypeLabel = FOOD_TYPE_LABELS.vinos;
  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [
      { label: "Carta", href: "/app/comida" },
      { label: foodTypeLabel, href: "/app/comida/vinos" },
    ];
    if (vino && !isNew) {
      items.push({ label: vino.nombre || `#${vino.num}` });
    }
    return items;
  }, [vino, isNew, foodTypeLabel]);

  return (
    <section
      ref={sectionRef}
      aria-label="Detalle de vino"
      data-role="wine-detail-editor"
      className="flex flex-col gap-6 bo-fadeout"
    >
      <div
        data-ui="wine-detail-topbar"
        className="flex items-center justify-between"
      >
        <Breadcrumbs items={breadcrumbItems} className="bo-breadcrumb--truncate" />
        <span
          className={`bo-badge bo-badge--sm ${form.active ? "bo-badge--active" : "bo-badge--inactive"}`}
          data-role="wine-detail-status-badge"
        >
          {form.active ? "Visible" : "Oculto"}
        </span>
      </div>

      <div
        data-ui="wine-detail-hero"
        className="flex flex-col items-center gap-4 rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)]/60 p-4 backdrop-blur-sm"
      >
        <div
          data-slot="wine-detail-media"
          className="w-full max-w-[160px] rounded-lg overflow-hidden bg-[var(--bo-surface-2)]"
        >
          {vino && !isNew ? (
            <WineImageAdvisor
              imageUrl={imageUrl}
              uploading={uploading}
              generating={generating}
              disabled={saving}
              onUpload={uploadImage}
              onGenerateAI={uploadImageAI}
              fileInputRef={fileInputRef}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-[var(--bo-muted)]"
              aria-hidden="true"
              data-role="wine-detail-media-placeholder"
            >
              <Wine size={36} data-role="wine-detail-wine-icon" />
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={saving || busy}
          data-role="wine-image-select-btn"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
            bg-[var(--bo-surface-2)] text-[var(--bo-text)] border border-[var(--bo-border)]
            hover:bg-[var(--bo-surface-3)] transition-colors duration-150
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload size={14} data-slot="wine-image-select-icon" />
          {imageUrl ? "Cambiar imagen" : "Subir imagen"}
        </button>

        <div
          data-slot="wine-detail-hero-body"
          className="w-full flex items-center justify-between text-sm"
        >
          <div
            data-ui="wine-detail-price-wrap"
            className="w-full text-xl font-semibold tabular-nums text-[var(--bo-accent)] tracking-tight"
          >
            {new Intl.NumberFormat("es-ES", {
              style: "currency",
              currency: "EUR",
            }).format(Number(form.precio || 0))}
          </div>
        </div>
      </div>

      <Panel
        data-ui="wine-detail-editor"
        className="bo-foodDetailPanel bo-foodDetailQuickEditor"
        headClassName="bo-foodDetailQuickHead flex-col items-stretch gap-1"
        title={isNew ? "Nuevo vino" : "Editar vino"}
        meta={isNew ? "Rellena los datos para crear un nuevo vino." : "Modifica los campos y guarda los cambios."}
      >
        <div data-slot="wine-detail-editor-body">
          <div
            data-ui="wine-detail-editor-grid"
            className="bo-foodDetailQuickGrid"
          >
            <label
              className="bo-field"
              data-slot="wine-detail-name-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-name-label"
              >
                Nombre
              </span>
              <input
                type="text"
                className="bo-input"
                value={form.nombre}
                onChange={(e) => setField("nombre", e.target.value)}
                disabled={saving}
                data-role="wine-detail-name-input"
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-tipo-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-tipo-label"
              >
                Tipo
              </span>
              <Select
                value={form.tipo}
                onChange={(v) => setField("tipo", v)}
                options={tipoSelectOptions}
                ariaLabel="Tipo de vino"
                disabled={saving}
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-precio-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-precio-label"
              >
                Precio (EUR)
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                className="bo-input"
                value={form.precio}
                onChange={(e) => setField("precio", e.target.value)}
                disabled={saving}
                data-role="wine-detail-precio-input"
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-bodega-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-bodega-label"
              >
                Bodega
              </span>
              <input
                type="text"
                className="bo-input"
                value={form.bodega}
                onChange={(e) => setField("bodega", e.target.value)}
                disabled={saving}
                data-role="wine-detail-bodega-input"
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-do-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-do-label"
              >
                D.O.
              </span>
              <input
                type="text"
                className="bo-input"
                value={form.denominacion_origen}
                onChange={(e) =>
                  setField("denominacion_origen", e.target.value)}
                disabled={saving}
                data-role="wine-detail-do-input"
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-graduacion-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-graduacion-label"
              >
                Graduacion (% vol)
              </span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="bo-input"
                value={form.graduacion}
                onChange={(e) => setField("graduacion", e.target.value)}
                disabled={saving}
                data-role="wine-detail-graduacion-input"
              />
            </label>

            <label
              className="bo-field"
              data-slot="wine-detail-anyo-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-anyo-label"
              >
                Anyo
              </span>
              <input
                type="text"
                className="bo-input"
                value={form.anyo}
                onChange={(e) => setField("anyo", e.target.value)}
                disabled={saving}
                data-role="wine-detail-anyo-input"
              />
            </label>

            <div
              className="bo-foodDetailQuickStatus"
              data-ui="wine-detail-active"
            >
              <span
                className="bo-label"
                data-role="wine-detail-active-label"
              >
                Visible en carta
              </span>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setField("active", v)}
                disabled={saving}
                aria-label="Cambiar visibilidad del vino"
              />
            </div>

            <label
              className="bo-field bo-foodDetailQuickDescription mb-4"
              data-slot="wine-detail-description-field"
            >
              <span
                className="bo-label"
                data-role="wine-detail-description-label"
              >
                Descripcion
              </span>
              <textarea
                className="bo-textarea"
                rows={4}
                value={form.descripcion}
                onChange={(e) => setField("descripcion", e.target.value)}
                disabled={saving}
                data-role="wine-detail-description-textarea"
              />
            </label>
          </div>
        </div>

          <ProductionTypeSection
            itemId={vino ? vino.num : null}
            productionType={productionType}
            stockRecipeId={stockRecipeId}
            productName={vino?.nombre ?? form.nombre}
            source="vinos"
            onChange={(next) => {
              setProductionType(next);
              if (next === "RAW") setStockRecipeId(null);
            }}
            onSheetLinked={(sheetId) => {
              setStockRecipeId(sheetId);
              setProductionType("MANUFACTURED");
            }}
          />

        <div
          data-slot="wine-detail-editor-actions"
          className="bo-foodDetailEditorActions"
        >
          <button
            className="bo-btn bo-btn--primary gap-2"
            type="button"
            onClick={onInternalSave}
            disabled={!canSave}
            aria-label="Guardar vino"
            title="Guardar vino"
            data-role="wine-detail-save-btn"
          >
            {saving ? (
              <>
                <Loader2
                  size={14}
                  className="bo-foodDetailSpinIcon"
                  data-role="wine-detail-save-spinner"
                />
                <span data-role="wine-detail-saving-text">Guardando...</span>
              </>
            ) : (
              <>
                <Save size={14} data-role="wine-detail-save-icon" />
                <span data-role="wine-detail-save-text">Guardar</span>
              </>
            )}
          </button>
        </div>
      </Panel>


    </section>
  );
}
