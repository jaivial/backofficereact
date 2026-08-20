import React, { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";

import { request, type Movement, type StockItem } from "../stockItemApi";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";

function movementLabel(type: string): string {
  switch (type) {
    case "ADJUSTMENT": return "Ajuste";
    case "WASTE": return "Merma";
    case "SALE": return "Venta";
    case "PRODUCTION_OUT": return "Producción";
    case "TRANSFER_IN": return "Traslado entrada";
    case "TRANSFER_OUT": return "Traslado salida";
    case "RECEIPT": return "Recepción";
    case "COUNT": return "Recuento";
    default: return type;
  }
}

export function HistoryTab({ item }: { item: StockItem }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await request<{ movements: Movement[] }>(`/items/${item.id}/movements?pageSize=50`);
      setMovements(data.movements);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <LoadingSpinner centered size="sm" label="Cargando historial…" />;
  if (error) return <InlineAlert kind="error" title="Historial" message={error} />;
  if (movements.length === 0) {
    return (
      <EmptyState
        icon={<History size={32} aria-hidden="true" />}
        title="Sin movimientos"
        description="Aún no hay movimientos registrados para este artículo."
        data-ui="stock-item-history-empty"
      />
    );
  }

  return (
    <section className="bo-panel" aria-label="Historial de movimientos" data-ui="stock-item-history">
      <div className="bo-panelBody" data-ui="stock-item-history-body">
        <div className="bo-stockRowList" data-ui="stock-item-history-list">
          {movements.map((movement) => (
            <article className="bo-stockMovement" key={movement.id} data-ui="stock-item-history-entry">
              <div className="bo-stockMovementTop" data-ui="stock-item-history-entry-main">
                <strong data-ui="stock-item-history-type">{movementLabel(movement.type)}</strong>
                <span className={movement.quantityBase >= 0 ? "bo-stockTextSuccess" : "bo-stockTextDanger"} data-ui="stock-item-history-quantity">
                  {movement.quantityBase >= 0 ? "+" : ""}{movement.enteredQuantity} {movement.enteredUnit}
                </span>
              </div>
              <p className="bo-stockRowMeta" data-ui="stock-item-history-meta">
                {movement.warehouseName} · {movement.actorName} · {new Date(movement.occurredAt).toLocaleString("es-ES")}
              </p>
              {movement.wasteReason ? <p className="bo-stockNote" data-ui="stock-item-history-reason">Motivo: {movement.wasteReason}</p> : null}
              {movement.note ? <p className="bo-stockNote" data-ui="stock-item-history-note">{movement.note}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
