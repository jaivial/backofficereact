import React, { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";

type ExpiringItem = {
  itemId: number;
  itemName: string;
  warehouseId: number;
  warehouseName: string;
  expiresAt: string;
  estimatedQtyBase: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

async function expiringRequest<T>(path: string): Promise<T> {
  const response = await fetch(`/api/admin/stock${path}`, { credentials: "include" });
  const body = await response.json();
  if (!response.ok || !body.success) throw new Error(body.message || "Error de stock");
  return body as T;
}

export function StockExpiringPanel() {
  const [items, setItems] = useState<ExpiringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await expiringRequest<{ items: ExpiringItem[] }>("/expiring?days=30");
      setItems(data.items || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el aviso de caducidades");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingSpinner centered size="sm" label="Comprobando caducidades…" />;
  if (error) return <InlineAlert kind="error" title="Caducidades" message={error} />;
  if (items.length === 0) return null;

  return (
    <section className="bo-panel" aria-labelledby="stock-expiring-title" data-ui="stock-expiring-panel" data-testid="stock-expiring-panel">
      <div className="bo-panelHead" data-ui="stock-expiring-header">
        <div data-ui="stock-expiring-heading">
          <h2 id="stock-expiring-title" className="bo-panelTitle" data-ui="stock-expiring-title">
            <CalendarClock className="bo-ico" size={18} aria-hidden="true" data-ui="stock-expiring-title-icon" />
            Caduca pronto (30 días)
          </h2>
          <p className="bo-panelMeta" data-ui="stock-expiring-subtitle">Estimación según las compras con caducidad registrada.</p>
        </div>
        <StatusBadge variant="warning" size="sm" data-ui="stock-expiring-count" data-testid="stock-expiring-count">{items.length}</StatusBadge>
      </div>
      <div className="bo-panelBody" data-ui="stock-expiring-body">
        <div className="bo-stockRowList" data-ui="stock-expiring-list" data-testid="stock-expiring-list">
          {items.map((item) => {
            const daysLeft = Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / DAY_MS);
            return (
              <article className="bo-stockMovement" key={`${item.itemId}-${item.warehouseId}-${item.expiresAt}`} data-ui="stock-expiring-entry">
                <div className="bo-stockMovementTop" data-ui="stock-expiring-entry-main">
                  <strong data-ui="stock-expiring-item">{item.itemName}</strong>
                  <span className={daysLeft <= 7 ? "bo-stockTextDanger" : "bo-stockTextWarning"} data-ui="stock-expiring-date">
                    {new Date(item.expiresAt).toLocaleDateString("es-ES")} · {daysLeft <= 0 ? "hoy o vencido" : `${daysLeft} días`}
                  </span>
                </div>
                <p className="bo-stockRowMeta" data-ui="stock-expiring-meta">
                  {item.warehouseName} · ≈{new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(item.estimatedQtyBase)} en almacén
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
