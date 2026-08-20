import React, { useMemo, useState } from "react";

import { request, type StockItem, type Warehouse } from "../stockItemApi";
import { Button } from "../../../../../ui/actions/Button";
import { FormField } from "../../../../../ui/inputs/FormField";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

const WASTE_REASONS: { value: string; label: string }[] = [
  { value: "SPOILAGE", label: "Caducidad" },
  { value: "BREAKAGE", label: "Rotura" },
  { value: "OVERPRODUCTION", label: "Sobreproducción" },
  { value: "STAFF_MEAL", label: "Comida personal" },
  { value: "CUSTOMER_RETURN", label: "Devolución cliente" },
  { value: "PREP_LOSS", label: "Pérdida en preparación" },
  { value: "THEFT", label: "Robo" },
  { value: "OTHER", label: "Otro" },
];

type Props = {
  item: StockItem;
  warehouses: Warehouse[];
  onChanged: () => void | Promise<void>;
};

export function WasteTab({ item, warehouses, onChanged }: Props) {
  const defaultWarehouseId = useMemo(
    () => (warehouses.find((warehouse) => warehouse.isDefault)?.id || warehouses[0]?.id || 0),
    [warehouses],
  );
  const [warehouseId, setWarehouseId] = useState<number>(defaultWarehouseId);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("SPOILAGE");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!item.isTracked) {
    return (
      <section className="bo-panel" aria-label="Merma" data-ui="stock-item-waste">
        <div className="bo-panelBody" data-ui="stock-item-waste-body">
          <InlineAlert kind="info" title="Artículo no seguido" message="Este artículo no tiene seguimiento de stock, por lo que no se puede registrar merma." />
        </div>
      </section>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0 || !warehouseId) {
      setError("Introduce una cantidad válida y un almacén");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await request(`/items/${item.id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          warehouseId,
          quantity: amount,
          unitId: item.displayUnit.id,
          type: "WASTE",
          wasteReason: reason,
          note: note.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setQuantity("1");
      setNote("");
      setDone(true);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo registrar la merma");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bo-panel" aria-label="Merma" data-ui="stock-item-waste">
      <div className="bo-panelHead" data-ui="stock-item-waste-header">
        <h2 className="bo-panelTitle" data-ui="stock-item-waste-title">Registrar merma</h2>
      </div>
      <div className="bo-panelBody" data-ui="stock-item-waste-body">
        {error ? <InlineAlert kind="error" title="Merma" message={error} /> : null}
        {done ? <InlineAlert kind="success" title="Merma" message="Merma registrada correctamente." /> : null}
        <form className="bo-stockForm" onSubmit={submit} data-ui="stock-item-waste-form">
          <div className="bo-stockFormGrid bo-stockFormGrid--3" data-ui="stock-item-waste-fields">
            <FormField label="Almacén" htmlFor="waste-warehouse">
              <select
                id="waste-warehouse"
                className="bo-input"
                value={warehouseId}
                onChange={(event) => setWarehouseId(Number(event.target.value))}
                data-ui="stock-item-waste-warehouse"
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label={`Cantidad (${item.displayUnit.label})`} htmlFor="waste-quantity">
              <input
                id="waste-quantity"
                className="bo-input"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                data-ui="stock-item-waste-quantity"
              />
            </FormField>
            <FormField label="Motivo" htmlFor="waste-reason">
              <select
                id="waste-reason"
                className="bo-input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                data-ui="stock-item-waste-reason"
              >
                {WASTE_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Nota (opcional)" htmlFor="waste-note">
            <input
              id="waste-note"
              className="bo-input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-ui="stock-item-waste-note"
            />
          </FormField>
          <Button variant="primary" type="submit" disabled={busy} data-ui="stock-item-waste-submit">
            Registrar merma
          </Button>
        </form>
      </div>
    </section>
  );
}
