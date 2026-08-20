import React, { useState } from "react";

import { request, type StockItem } from "../stockItemApi";
import { Button } from "../../../../../ui/actions/Button";
import { FormField } from "../../../../../ui/inputs/FormField";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

type Props = {
  item: StockItem;
  onChanged: () => void | Promise<void>;
};

export function CostTab({ item, onChanged }: Props) {
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const pricePerDisplayUnit = Number(price);
    if (!Number.isFinite(pricePerDisplayUnit) || pricePerDisplayUnit < 0) {
      setError("Introduce un coste válido (€ por unidad de display)");
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    try {
      await request(`/items/${item.id}/prices`, {
        method: "POST",
        body: JSON.stringify({
          unitCostBase: pricePerDisplayUnit / item.displayUnit.factorToBase,
          supplierName: supplier.trim() || undefined,
        }),
      });
      setPrice("");
      setSupplier("");
      setDone(true);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el coste");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bo-panel" aria-label="Coste" data-ui="stock-item-cost">
      <div className="bo-panelHead" data-ui="stock-item-cost-header">
        <h2 className="bo-panelTitle" data-ui="stock-item-cost-title">Coste de compra</h2>
      </div>
      <div className="bo-panelBody" data-ui="stock-item-cost-body">
        {error ? <InlineAlert kind="error" title="Coste" message={error} /> : null}
        {done ? <InlineAlert kind="success" title="Coste" message="Coste registrado correctamente." /> : null}
        <form className="bo-stockForm" onSubmit={submit} data-ui="stock-item-cost-form">
          <div className="bo-stockFormGrid bo-stockFormGrid--2" data-ui="stock-item-cost-fields">
            <FormField label={`Coste por ${item.displayUnit.label} (€)`} htmlFor="cost-price">
              <input
                id="cost-price"
                className="bo-input"
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0.00"
                data-ui="stock-item-cost-price"
              />
            </FormField>
            <FormField label="Proveedor (opcional)" htmlFor="cost-supplier">
              <input
                id="cost-supplier"
                className="bo-input"
                value={supplier}
                onChange={(event) => setSupplier(event.target.value)}
                data-ui="stock-item-cost-supplier"
              />
            </FormField>
          </div>
          <Button variant="primary" type="submit" disabled={busy} data-ui="stock-item-cost-submit">
            Guardar coste
          </Button>
        </form>
      </div>
    </section>
  );
}
