import React, { useCallback, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";

type Warehouse = { id: number; name: string; isDefault: boolean };
type CountLine = { itemId: number; name: string; expectedQuantityBase: number; enteredQuantity?: number; unitId: number; unitLabel: string; factorToBase: number };

type CountSheet = { id: number; warehouseId: number; warehouseName: string; status: string; lines: CountLine[] };

async function countRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error en recuento");
  return body as T;
}

export function StockCountPanel({ warehouses, onClosed }: { warehouses: Warehouse[]; onClosed: () => void | Promise<void> }) {
  const [warehouseId, setWarehouseId] = useState(0);
  const [sheet, setSheet] = useState<CountSheet | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selectedWarehouseId = useMemo(() => warehouseId || warehouses.find((warehouse) => warehouse.isDefault)?.id || 0, [warehouseId, warehouses]);

  const open = useCallback(async () => {
    if (!selectedWarehouseId) return;
    setBusy(true); setError("");
    try { const created = await countRequest<{ id: number }>("/counts", { method: "POST", body: JSON.stringify({ warehouseId: selectedWarehouseId }) }); const detail = await countRequest<CountSheet>(`/counts/${created.id}`); setSheet(detail); setValues(Object.fromEntries(detail.lines.map((line) => [line.itemId, String(line.expectedQuantityBase / line.factorToBase)]))); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo abrir el recuento"); }
    finally { setBusy(false); }
  }, [selectedWarehouseId]);

  const close = useCallback(async () => {
    if (!sheet) return;
    setBusy(true); setError("");
    try { await countRequest(`/counts/${sheet.id}/close`, { method: "POST", body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), lines: sheet.lines.map((line) => ({ itemId: line.itemId, unitId: line.unitId, quantity: Number(values[line.itemId]) })) }) }); setSheet(null); await onClosed(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo cerrar el recuento"); }
    finally { setBusy(false); }
  }, [onClosed, sheet, values]);

  return (
    <details className="bo-panel bo-stockDetails" data-ui="stock-count-panel">
      <summary className="bo-stockDetailsSummary" data-ui="stock-count-summary">Recuento físico</summary>
      <div className="bo-stockDetailsBody" data-ui="stock-count-body">
        {!sheet ? (
          <div className="bo-stockToolbar" data-ui="stock-count-open-controls">
            <FormField className="bo-stockFilterField" label="Almacén" htmlFor="stock-count-warehouse">
              <select id="stock-count-warehouse" className="bo-input" value={selectedWarehouseId} onChange={(event) => setWarehouseId(Number(event.target.value))} data-ui="stock-count-warehouse">
                {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id} data-ui="stock-count-warehouse-option">{warehouse.name}</option>)}
              </select>
            </FormField>
            <Button variant="primary" disabled={!selectedWarehouseId || busy} onClick={() => void open()} data-ui="stock-count-open">Abrir recuento</Button>
          </div>
        ) : (
          <div className="bo-stockForm" data-ui="stock-count-sheet">
            <p className="bo-stockNote" data-ui="stock-count-sheet-title">{sheet.warehouseName} · introduce existencias observadas</p>
            <div className="bo-stockRowList" data-ui="stock-count-lines">
              {sheet.lines.map((line) => (
                <label className="bo-stockRow" key={line.itemId} data-ui="stock-count-line">
                  <span data-ui="stock-count-line-name">{line.name}</span>
                  <span className="bo-stockRowActions" data-ui="stock-count-line-input-wrap">
                    <input className="bo-input" style={{ width: 112, textAlign: "right" }} inputMode="decimal" value={values[line.itemId] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [line.itemId]: event.target.value }))} data-ui="stock-count-line-input" />
                    <span className="bo-stockAdjustUnit" data-ui="stock-count-line-unit">{line.unitLabel}</span>
                  </span>
                </label>
              ))}
            </div>
            <Button variant="primary" className="bo-btn--fit" disabled={busy || sheet.lines.some((line) => !Number.isFinite(Number(values[line.itemId])) || Number(values[line.itemId]) < 0)} onClick={() => void close()} data-ui="stock-count-close">Cerrar y ajustar stock</Button>
          </div>
        )}

        {error ? <InlineAlert kind="error" title="Recuento" message={error} /> : null}
      </div>
    </details>
  );
}
