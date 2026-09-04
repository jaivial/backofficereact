import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "../../../../../ui/actions/Button";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";

// Merma: portions that were produced but never sold.
//
// Decision #1 means raw goods are consumed at PRODUCTION, not at sale, so a
// tray of unsold paella has already left the ingredient stock. Recording it
// here writes the finished portions off against the reason, which is what makes
// overproduction visible instead of silently disappearing into shrinkage.

type StockItem = {
  id: number;
  name: string;
  displayUnit: { id: number; label: string; factorToBase: number };
};

type Warehouse = { id: number; name: string };

// Every option is a real cause. There is deliberately no blank default: waste
// with no reason cannot be analysed, and "other" already covers the unknown.
const WASTE_REASONS: { value: string; label: string }[] = [
  { value: "OVERPRODUCTION", label: "Sobreproduccion (raciones no vendidas)" },
  { value: "SPOILAGE", label: "Caducado o en mal estado" },
  { value: "PREP_LOSS", label: "Perdida en elaboracion" },
  { value: "BREAKAGE", label: "Rotura" },
  { value: "STAFF_MEAL", label: "Comida de personal" },
  { value: "CUSTOMER_RETURN", label: "Devolucion de cliente" },
  { value: "OTHER", label: "Otro" },
];

async function stockRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || "Error de stock");
  }
  return body as T;
}

export function PortionWastePanel() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [itemId, setItemId] = useState(0);
  const [warehouseId, setWarehouseId] = useState(0);
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState(WASTE_REASONS[0].value);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([
      stockRequest<{ items: StockItem[] }>("/items"),
      stockRequest<{ warehouses: Warehouse[] }>("/warehouses"),
    ])
      .then(([itemsBody, warehousesBody]) => {
        setItems(itemsBody.items ?? []);
        setWarehouses(warehousesBody.warehouses ?? []);
        setItemId(itemsBody.items?.[0]?.id ?? 0);
        setWarehouseId(warehousesBody.warehouses?.[0]?.id ?? 0);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === itemId),
    [itemId, items],
  );

  const submit = useCallback(async () => {
    setError("");
    setMessage("");
    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("La cantidad debe ser mayor que cero");
      return;
    }
    if (!selectedItem || !warehouseId) {
      setError("Selecciona el articulo y el almacen");
      return;
    }
    setSaving(true);
    try {
      await stockRequest(`/items/${selectedItem.id}/movements`, {
        method: "POST",
        body: JSON.stringify({
          warehouseId,
          // Waste removes stock, so the movement is negative. Sending a
          // positive quantity would add the wasted portions back to inventory.
          quantity: -amount,
          unitId: selectedItem.displayUnit.id,
          type: "WASTE",
          wasteReason: reason,
          note: note.trim(),
          // A retry must not deduct the same portions twice.
          idempotencyKey: `waste-${selectedItem.id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        }),
      });
      setMessage("Merma registrada");
      setQuantity("1");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar la merma");
    } finally {
      setSaving(false);
    }
  }, [note, quantity, reason, selectedItem, warehouseId]);

  return (
    <section className="bo-stack" data-ui="portion-waste-panel" data-testid="portion-waste-panel">
      <h3 data-slot="portionWastePanel-sectionTitle" className="bo-sectionTitle">Registrar merma de raciones</h3>
      <p data-slot="portionWastePanel-muted" className="bo-muted">
        Las raciones producidas y no vendidas se dan de baja aqui. Los ingredientes ya se
        descontaron al producir, por lo que esta baja afecta al producto terminado.
      </p>

      {error ? <InlineAlert kind="error" title={error} /> : null}
      {message ? <InlineAlert kind="success" title={message} /> : null}

      <FormField label="Articulo" htmlFor="portion-waste-item">
        <select
          id="portion-waste-item"
          className="bo-input"
          data-ui="portion-waste-item"
          data-testid="portion-waste-item"
          value={itemId}
          onChange={(event) => setItemId(Number(event.currentTarget.value))}
        >
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Almacen" htmlFor="portion-waste-warehouse">
        <select
          id="portion-waste-warehouse"
          className="bo-input"
          data-ui="portion-waste-warehouse"
          data-testid="portion-waste-warehouse"
          value={warehouseId}
          onChange={(event) => setWarehouseId(Number(event.currentTarget.value))}
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label={`Cantidad${selectedItem ? ` (${selectedItem.displayUnit.label})` : ""}`}
        htmlFor="portion-waste-quantity"
      >
        <input
          id="portion-waste-quantity"
          className="bo-input"
          inputMode="decimal"
          data-ui="portion-waste-quantity"
          data-testid="portion-waste-quantity"
          value={quantity}
          onChange={(event) => setQuantity(event.currentTarget.value)}
        />
      </FormField>

      <FormField label="Motivo" htmlFor="portion-waste-reason">
        <select
          id="portion-waste-reason"
          className="bo-input"
          data-ui="portion-waste-reason"
          data-testid="portion-waste-reason"
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
        >
          {WASTE_REASONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Nota (opcional)" htmlFor="portion-waste-note">
        <input
          id="portion-waste-note"
          className="bo-input"
          data-ui="portion-waste-note"
          data-testid="portion-waste-note"
          value={note}
          onChange={(event) => setNote(event.currentTarget.value)}
        />
      </FormField>

      <Button variant="primary" disabled={saving} onClick={() => void submit()}>
        Registrar merma
      </Button>
    </section>
  );
}
