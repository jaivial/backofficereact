import React, { useState } from "react";

import { request, type StockItem } from "../stockItemApi";
import { Button } from "../../../../../ui/actions/Button";
import { FormField } from "../../../../../ui/inputs/FormField";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "RAW", label: "Materia prima" },
  { value: "SEMI_FINISHED", label: "Semi-elaborado" },
  { value: "FINISHED", label: "Elaborado" },
  { value: "CONSUMABLE", label: "Consumible" },
];

const DEDUCTION_OPTIONS: { value: string; label: string }[] = [
  { value: "BOTH_MANUAL", label: "Manual" },
  { value: "PRODUCTION", label: "Elaboración" },
  { value: "SALE", label: "Venta" },
];

type Props = {
  item: StockItem;
  onChanged: () => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
};

export function SettingsTab({ item, onChanged, onDeleted }: Props) {
  const [name, setName] = useState(item.name);
  const [sku, setSku] = useState(item.sku || "");
  const [barcode, setBarcode] = useState(item.barcode || "");
  const [kind, setKind] = useState(item.kind);
  const [isTracked, setIsTracked] = useState(item.isTracked);
  const [deductionSource, setDeductionSource] = useState(item.deductionSource);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await request(`/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          sku: sku.trim(),
          barcode: barcode.trim(),
          kind,
          isTracked,
          deductionSource,
        }),
      });
      setDone(true);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el artículo");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Eliminar ${item.name}? Debe tener el stock a cero.`)) return;
    setBusy(true);
    setError("");
    try {
      await request(`/items/${item.id}`, { method: "DELETE" });
      await onDeleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar el artículo");
      setBusy(false);
    }
  };

  return (
    <section className="bo-panel" aria-label="Ajustes" data-ui="stock-item-settings">
      <div className="bo-panelHead" data-ui="stock-item-settings-header">
        <h2 className="bo-panelTitle" data-ui="stock-item-settings-title">Ajustes generales</h2>
      </div>
      <div className="bo-panelBody" data-ui="stock-item-settings-body">
        {error ? <InlineAlert kind="error" title="Ajustes" message={error} /> : null}
        {done ? <InlineAlert kind="success" title="Ajustes" message="Cambios guardados correctamente." /> : null}
        <form className="bo-stockForm" onSubmit={save} data-ui="stock-item-settings-form">
          <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-item-settings-fields">
            <FormField label="Nombre" htmlFor="settings-name">
              <input
                id="settings-name"
                className="bo-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                data-ui="stock-item-settings-name"
              />
            </FormField>
            <FormField label="SKU" htmlFor="settings-sku">
              <input
                id="settings-sku"
                className="bo-input"
                value={sku}
                onChange={(event) => setSku(event.target.value)}
                data-ui="stock-item-settings-sku"
              />
            </FormField>
            <FormField label="Código de barras" htmlFor="settings-barcode">
              <input
                id="settings-barcode"
                className="bo-input"
                inputMode="numeric"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                data-ui="stock-item-settings-barcode"
              />
            </FormField>
            <FormField label="Tipo" htmlFor="settings-kind">
              <select
                id="settings-kind"
                className="bo-input"
                value={kind}
                onChange={(event) => setKind(event.target.value)}
                data-ui="stock-item-settings-kind"
              >
                {KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Deducción" htmlFor="settings-deduction">
              <select
                id="settings-deduction"
                className="bo-input"
                value={deductionSource}
                onChange={(event) => setDeductionSource(event.target.value)}
                data-ui="stock-item-settings-deduction"
              >
                {DEDUCTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <label className="bo-stockCheckbox" data-ui="stock-item-settings-tracked">
            <input
              type="checkbox"
              checked={isTracked}
              onChange={(event) => setIsTracked(event.target.checked)}
              data-ui="stock-item-settings-tracked-input"
            />
            Seguir existencias de este artículo
          </label>
          <div className="bo-stockFormActions" data-ui="stock-item-settings-actions">
            <Button variant="primary" type="submit" disabled={busy} data-ui="stock-item-settings-save">
              Guardar cambios
            </Button>
            <Button variant="danger" type="button" disabled={busy} onClick={() => void remove()} data-ui="stock-item-settings-delete">
              Eliminar artículo
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
