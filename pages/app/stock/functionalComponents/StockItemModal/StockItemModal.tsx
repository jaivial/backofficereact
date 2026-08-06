import React, { useCallback, useEffect, useState } from "react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import { Select } from "../../../../../ui/inputs/Select";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ProductionTypeSection } from "../../../comida/_components/TechnicalSheet/ProductionTypeSection";
import type { ProductionType } from "../../../comida/_components/TechnicalSheet/ProductionTypeToggle";

// Creation dialog for stock articles. Reuses the technical sheet section from
// the product editor ("Nuevo elemento"): Materia prima creates a plain RAW
// stock item, while Preparado requires a ficha tecnica - the sheet create
// already produces the output stock article server-side, so the modal only
// closes once one exists.

const DIMENSION_OPTIONS = [
  { value: "MASS", label: "Masa" },
  { value: "VOLUME", label: "Volumen" },
  { value: "COUNT", label: "Unidades" },
];

async function createRawItem(input: {
  name: string;
  baseDimension: string;
  displayUnitCode: string;
  displayUnitFactor: number;
}): Promise<void> {
  const response = await fetch("/api/admin/stock/items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name,
      kind: "RAW",
      baseDimension: input.baseDimension,
      isTracked: true,
      deductionSource: "BOTH_MANUAL",
      displayUnitCode: input.displayUnitCode,
      displayUnitLabel: input.displayUnitCode,
      displayUnitFactor: input.displayUnitFactor,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(body.message || "No se pudo crear el articulo");
  }
}

export function StockItemModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [dimension, setDimension] = useState("MASS");
  const [unidad, setUnidad] = useState("kg");
  const [factor, setFactor] = useState("1000");
  const [productionType, setProductionType] = useState<ProductionType>("RAW");
  const [stockRecipeId, setStockRecipeId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Fresh form on every open; the sheet link belongs to this creation only.
  useEffect(() => {
    if (!open) return;
    setNombre("");
    setDimension("MASS");
    setUnidad("kg");
    setFactor("1000");
    setProductionType("RAW");
    setStockRecipeId(null);
    setError("");
    setSaving(false);
  }, [open]);

  const isPreparado = productionType === "MANUFACTURED";
  // The user must build the ficha first: a Preparado article without a recipe
  // cannot be produced, so the form stays blocked until one exists.
  const missingSheet = isPreparado && stockRecipeId == null;

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const name = nombre.trim();
      if (!name) {
        setError("El nombre es obligatorio");
        return;
      }
      if (isPreparado && stockRecipeId == null) {
        setError("Crea o selecciona una ficha tecnica antes de crear el articulo");
        return;
      }
      const factorNum = Number(factor);
      if (!Number.isFinite(factorNum) || factorNum <= 0) {
        setError("El factor base debe ser mayor que cero");
        return;
      }
      const unit = unidad.trim();
      if (!unit) {
        setError("La unidad visible es obligatoria");
        return;
      }
      setSaving(true);
      setError("");
      try {
        if (!isPreparado) {
          await createRawItem({
            name,
            baseDimension: dimension,
            displayUnitCode: unit,
            displayUnitFactor: factorNum,
          });
        }
        // Preparado: the ficha already created its output article on the
        // server; nothing else to persist here.
        onClose();
        await onCreated();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "No se pudo crear el articulo");
      } finally {
        setSaving(false);
      }
    },
    [dimension, factor, isPreparado, nombre, onClose, onCreated, stockRecipeId, unidad],
  );

  return (
    <Modal open={open} title="Nuevo artículo" onClose={onClose} size="lg">
      <form className="bo-stockForm" onSubmit={submit} data-ui="stock-item-dialog">
        <div data-ui="food-modal-grid" className="bo-foodModal-grid">
          <div data-slot="food-modal-fields" className="bo-foodModal-fields">
            <FormField label="Nombre" htmlFor="stock-item-name" required>
              <input
                id="stock-item-name"
                className="bo-input"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                placeholder="Nombre del articulo"
                required
                data-testid="stock-item-name"
              />
            </FormField>

            <FormField label="Dimensión" htmlFor="stock-item-dimension">
              {/* Reusable dropdown, not the native select. */}
              <Select
                value={dimension}
                onChange={setDimension}
                options={DIMENSION_OPTIONS}
                ariaLabel="Dimensión"
                data-testid="stock-item-dimension"
              />
            </FormField>

            <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-item-unit-row">
              <FormField label="Unidad visible" htmlFor="stock-item-unit" required>
                <input
                  id="stock-item-unit"
                  className="bo-input"
                  value={unidad}
                  onChange={(event) => setUnidad(event.target.value)}
                  required
                  data-testid="stock-item-unit"
                />
              </FormField>
              <FormField label="Factor base" htmlFor="stock-item-factor" required>
                <input
                  id="stock-item-factor"
                  className="bo-input"
                  inputMode="decimal"
                  value={factor}
                  onChange={(event) => setFactor(event.target.value)}
                  required
                  data-testid="stock-item-factor"
                />
              </FormField>
            </div>

            <ProductionTypeSection
              itemId={null}
              productionType={productionType}
              stockRecipeId={stockRecipeId}
              productName={nombre}
              onChange={(next) => {
                setProductionType(next);
                // Back to Materia prima releases the sheet link: the article is
                // bought and sold as-is, so it must not keep a recipe.
                if (next === "RAW") setStockRecipeId(null);
              }}
              onSheetLinked={(sheetId) => setStockRecipeId(sheetId)}
              sheetOutputUnit={{
                baseDimension: dimension,
                displayUnitCode: unidad,
                displayUnitLabel: unidad,
                displayUnitFactor: Number(factor) || 1,
              }}
            />

            {missingSheet ? (
              <p className="bo-sheetHint" data-role="stock-item-sheet-hint">
                Crea o selecciona una ficha tecnica para crear el articulo.
              </p>
            ) : null}

            {error ? <InlineAlert kind="error" title={error} /> : null}
          </div>
        </div>

        <div data-slot="food-modal-actions" className="bo-foodModal-actions">
          <button
            data-role="food-modal-cancel-btn"
            type="button"
            className="bo-btn bo-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            data-role="food-modal-submit-btn"
            type="submit"
            className="bo-btn bo-btn--primary mx-0"
            disabled={saving || missingSheet}
            data-testid="stock-create-item"
          >
            {saving ? "Creando..." : "Crear artículo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
