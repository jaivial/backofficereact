import React, { useCallback, useMemo } from "react";
import { ChevronLeft, Loader2, Save, Wine } from "lucide-react";

import { FOOD_TYPE_LABELS } from "../../../../_components/foodTypes";
import { Select } from "../../../../../../../ui/inputs/Select";
import { Switch } from "../../../../../../../ui/shadcn/Switch";
import type { WineDetailEditorProps } from "./types";
import { WINE_TIPO_OPTIONS } from "./constants";
import { useWineForm } from "./hooks/useWineForm";
import { useWineImage } from "./hooks/useWineImage";
import { useWineAIWebSocket } from "./hooks/useWineAIWebSocket";
import { WineImageAdvisor } from "./ui/WineImageAdvisor";

export function WineDetailEditor({ vino, isNew, onSave }: WineDetailEditorProps) {
  const { form, saving, dirty, canSave, createdId, setField, save } = useWineForm(vino, isNew);
  const {
    uploading,
    generating,
    imageUrl,
    uploadImage,
    uploadImageAI,
    updateFromWS,
    setGeneratingFromWS,
  } = useWineImage(vino);

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

  return (
    <section
      aria-label="Detalle de vino"
      data-role="wine-detail-editor"
      className="flex flex-col gap-6"
    >
      <div
        data-ui="wine-detail-topbar"
        className="flex items-center justify-between"
      >
        <button
          className="bo-menuBackBtn"
          type="button"
          onClick={() => window.location.assign("/app/comida/vinos")}
          data-role="wine-detail-back-btn"
        >
          <ChevronLeft size={16} data-role="wine-detail-back-icon" />
          Volver a Vinos
        </button>
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
          className="w-full max-w-[180px] rounded-lg overflow-hidden bg-[var(--bo-surface-2)] aspect-square"
        >
          {vino && !isNew ? (
            <WineImageAdvisor
              imageUrl={imageUrl}
              uploading={uploading}
              generating={generating}
              disabled={saving}
              onUpload={uploadImage}
              onGenerateAI={uploadImageAI}
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

        <div
          data-slot="wine-detail-hero-body"
          className="w-full flex items-center justify-between text-sm"
        >
          <div
            data-role="wine-detail-eyebrow"
            className="font-medium text-[var(--bo-muted)] uppercase tracking-wider"
          >
            {FOOD_TYPE_LABELS.vinos}
            {vino && !isNew ? ` · #${vino.num}` : " · Nuevo"}
          </div>
          <div
            data-ui="wine-detail-price-wrap"
            className="text-xl font-semibold tabular-nums text-[var(--bo-accent)] tracking-tight"
          >
            {new Intl.NumberFormat("es-ES", {
              style: "currency",
              currency: "EUR",
            }).format(Number(form.precio || 0))}
          </div>
        </div>
      </div>

      <div
        data-ui="wine-detail-editor"
        className="bo-panel bo-foodDetailPanel bo-foodDetailQuickEditor"
      >
        <div
          data-slot="wine-detail-editor-head"
          className="bo-panelHead bo-foodDetailQuickHead"
        >
          <div data-slot="wine-detail-editor-title-wrap">
            <div
              data-role="wine-detail-editor-title"
              className="bo-panelTitle"
            >
              {isNew ? "Nuevo vino" : "Editar vino"}
            </div>
            <div
              data-role="wine-detail-editor-meta"
              className="bo-panelMeta"
            >
              {isNew
                ? "Rellena los datos para crear un nuevo vino."
                : "Modifica los campos y guarda los cambios."}
            </div>
          </div>
          <span
            className={`bo-badge bo-badge--sm ${dirty ? "bo-badge--warning" : "bo-badge--muted"}`}
            data-role="wine-detail-dirty-badge"
          >
            {dirty ? "Cambios sin guardar" : "Sin cambios"}
          </span>
        </div>

        <div data-slot="wine-detail-editor-body" className="bo-panelBody">
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
              className="bo-field bo-foodDetailQuickDescription"
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

        <div
          data-slot="wine-detail-editor-actions"
          className="bo-foodDetailEditorActions"
        >
          <button
            className="bo-btn bo-btn--primary"
            type="button"
            onClick={onInternalSave}
            disabled={!canSave}
            aria-label="Guardar vino"
            title="Guardar vino"
            data-role="wine-detail-save-btn"
          >
            {saving ? (
              <Loader2
                size={14}
                className="bo-foodDetailSpinIcon"
                data-role="wine-detail-save-spinner"
              />
            ) : (
              <Save size={14} data-role="wine-detail-save-icon" />
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
