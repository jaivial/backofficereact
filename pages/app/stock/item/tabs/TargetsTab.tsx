import React, { useMemo, useState } from "react";

import { request, type StockItem, type Warehouse } from "../stockItemApi";
import { Button } from "../../../../../ui/actions/Button";
import { FormField } from "../../../../../ui/inputs/FormField";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

type Props = {
  item: StockItem;
  warehouses: Warehouse[];
  onChanged: () => void | Promise<void>;
};

export function TargetsTab({ item, warehouses, onChanged }: Props) {
  const defaultWarehouseId = useMemo(
    () => (warehouses.find((warehouse) => warehouse.isDefault)?.id || warehouses[0]?.id || 0),
    [warehouses],
  );
  const factor = item.displayUnit.factorToBase;
  const [warehouseId, setWarehouseId] = useState<number>(defaultWarehouseId);
  const [par, setPar] = useState(String(item.parLevelBase / factor || 0));
  const [reorder, setReorder] = useState(String(item.reorderPointBase / factor || 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!warehouseId) {
      setError("Selecciona un almacén");
      return;
    }
    const parValue = Number(par);
    const reorderValue = Number(reorder);
    if (!Number.isFinite(parValue) || parValue < 0) {
      setError("El objetivo debe ser un número positivo");
      return;
    }
    if (!Number.isFinite(reorderValue) || reorderValue < 0 || (parValue > 0 && reorderValue > parValue)) {
      setError("El mínimo debe estar entre 0 y el objetivo");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await request(`/items/${item.id}/targets`, {
        method: "PATCH",
        body: JSON.stringify({
          warehouseId,
          unitId: item.displayUnit.id,
          parLevel: parValue,
          reorderPoint: reorderValue,
        }),
      });
      setDone(true);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudieron guardar los objetivos");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bo-panel" aria-label="Objetivos" data-ui="stock-item-targets">
      <div className="bo-panelHead" data-ui="stock-item-targets-header">
        <h2 className="bo-panelTitle" data-ui="stock-item-targets-title">Objetivos de stock</h2>
      </div>
      <div className="bo-panelBody" data-ui="stock-item-targets-body">
        {error ? <InlineAlert kind="error" title="Objetivos" message={error} /> : null}
        {done ? <InlineAlert kind="success" title="Objetivos" message="Objetivos guardados correctamente." /> : null}
        <form className="bo-stockForm" onSubmit={submit} data-ui="stock-item-targets-form">
          <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-item-targets-fields">
            <FormField label="Almacén" htmlFor="targets-warehouse">
              <select
                id="targets-warehouse"
                className="bo-input"
                value={warehouseId}
                onChange={(event) => setWarehouseId(Number(event.target.value))}
                data-ui="stock-item-targets-warehouse"
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label={`Objetivo (${item.displayUnit.label})`} htmlFor="targets-par">
              <input
                id="targets-par"
                className="bo-input"
                inputMode="decimal"
                value={par}
                onChange={(event) => setPar(event.target.value)}
                data-ui="stock-item-targets-par"
              />
            </FormField>
            <FormField label={`Mínimo reposición (${item.displayUnit.label})`} htmlFor="targets-reorder">
              <input
                id="targets-reorder"
                className="bo-input"
                inputMode="decimal"
                value={reorder}
                onChange={(event) => setReorder(event.target.value)}
                data-ui="stock-item-targets-reorder"
              />
            </FormField>
          </div>
          <Button variant="primary" type="submit" disabled={busy} data-ui="stock-item-targets-submit">
            Guardar objetivos
          </Button>
        </form>
      </div>
    </section>
  );
}
