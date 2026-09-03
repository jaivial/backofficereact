import React, { useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";

type ValuationItem = {
  itemId: number;
  itemName: string;
  categoryName: string;
  baseUnit: string;
  qtyBase: number;
  avgUnitCost: number;
  lastUnitCost: number | null;
  unitCost: number;
  value: number;
};

const EUR = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const QTY = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const COST = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 4 });

async function valuationRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { credentials: "include" });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}

// Base units are g / ml / ud; magnitudes in g or ml read better as kg / l.
function displayQty(qtyBase: number, baseUnit: string): string {
  if (baseUnit === "g" && Math.abs(qtyBase) >= 1000) return `${QTY.format(qtyBase / 1000)} kg`;
  if (baseUnit === "ml" && Math.abs(qtyBase) >= 1000) return `${QTY.format(qtyBase / 1000)} l`;
  return `${QTY.format(qtyBase)} ${baseUnit}`;
}

function displayCost(unitCost: number, baseUnit: string): string {
  if ((baseUnit === "g" || baseUnit === "ml") && unitCost > 0 && unitCost < 1) return `${COST.format(unitCost * 1000)}/${baseUnit === "g" ? "kg" : "l"}`;
  return `${COST.format(unitCost)}/${baseUnit || "ud"}`;
}

export function StockValuationPanel() {
  const [items, setItems] = useState<ValuationItem[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await valuationRequest<{ totalValue: number; items: ValuationItem[] }>("/valuation");
      setItems(data.items || []);
      setTotalValue(data.totalValue || 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la valoración del inventario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingSpinner centered size="sm" label="Calculando valoración…" />;
  if (error) return <InlineAlert kind="error" title="Valoración" message={error} />;
  if (items.length === 0) return null;

  return (
    <section className="bo-panel" aria-labelledby="stock-valuation-title" data-ui="stock-valuation-panel" data-testid="stock-valuation-panel">
      <div className="bo-panelHead" data-ui="stock-valuation-header">
        <div data-ui="stock-valuation-heading">
          <h2 id="stock-valuation-title" className="bo-panelTitle" data-ui="stock-valuation-title">
            <Coins className="bo-ico" size={18} aria-hidden="true" data-ui="stock-valuation-title-icon" />
            Valoración del inventario
          </h2>
          <p className="bo-panelMeta" data-ui="stock-valuation-subtitle">Valor al último coste de compra conocido; sin compras, al coste medio.</p>
        </div>
        <StatusBadge variant="info" size="sm" data-ui="stock-valuation-total" data-testid="stock-valuation-total">{EUR.format(totalValue)}</StatusBadge>
      </div>
      <div className="bo-panelBody" data-ui="stock-valuation-body">
        <div className="bo-stockTableScroll" data-ui="stock-valuation-table-wrap">
          <table className="bo-table" data-ui="stock-valuation-table" data-testid="stock-valuation-table">
            <thead data-ui="stock-valuation-table-head">
              <tr data-ui="stock-valuation-table-head-row">
                <th scope="col" data-ui="stock-valuation-th-item">Artículo</th>
                <th scope="col" data-ui="stock-valuation-th-category">Categoría</th>
                <th scope="col" data-ui="stock-valuation-th-qty">Cantidad</th>
                <th scope="col" data-ui="stock-valuation-th-cost">Coste unit.</th>
                <th scope="col" data-ui="stock-valuation-th-value">Valor</th>
              </tr>
            </thead>
            <tbody data-ui="stock-valuation-table-body">
              {items.map((item) => (
                <tr key={item.itemId} data-ui="stock-valuation-row" data-testid={`stock-valuation-row-${item.itemId}`}>
                  <td data-ui="stock-valuation-item">{item.itemName}</td>
                  <td data-ui="stock-valuation-category">{item.categoryName || "—"}</td>
                  <td data-ui="stock-valuation-qty">{displayQty(item.qtyBase, item.baseUnit)}</td>
                  <td data-ui="stock-valuation-cost">{displayCost(item.unitCost, item.baseUnit)}</td>
                  <td data-ui="stock-valuation-value">{EUR.format(item.value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot data-ui="stock-valuation-table-foot">
              <tr data-ui="stock-valuation-total-row">
                <td colSpan={4} data-ui="stock-valuation-total-label">Total</td>
                <td data-ui="stock-valuation-total-value" data-testid="stock-valuation-total-value">{EUR.format(totalValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </section>
  );
}
