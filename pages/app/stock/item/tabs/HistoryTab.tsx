import React, { useCallback, useEffect, useState } from "react";
import { History } from "lucide-react";

import { request, type Movement, type StockItem } from "../stockItemApi";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { FormField } from "../../../../../ui/inputs/FormField";
import { Select } from "../../../../../ui/inputs/Select";

const MOVEMENT_TYPES: { value: string; label: string }[] = [
  { value: "PURCHASE", label: "Compra" },
  { value: "ADJUSTMENT", label: "Ajuste" },
  { value: "WASTE", label: "Merma" },
  { value: "SALE", label: "Venta" },
  { value: "PRODUCTION_IN", label: "Producción entrada" },
  { value: "PRODUCTION_OUT", label: "Producción salida" },
  { value: "TRANSFER_IN", label: "Traslado entrada" },
  { value: "TRANSFER_OUT", label: "Traslado salida" },
  { value: "RETURN", label: "Devolución" },
  { value: "INVENTORY_COUNT", label: "Recuento" },
];

function movementLabel(type: string): string {
  return MOVEMENT_TYPES.find((option) => option.value === type)?.label ?? type;
}

const TYPE_OPTIONS = [{ value: "", label: "Todos los tipos" }, ...MOVEMENT_TYPES];

export function HistoryTab({ item }: { item: StockItem }) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = type !== "" || from !== "" || to !== "";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("pageSize", filtered ? "200" : "50");
      if (type) params.set("type", type);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const data = await request<{ movements: Movement[]; total: number }>(`/items/${item.id}/movements?${params.toString()}`);
      setMovements(data.movements);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el historial");
    } finally {
      setLoading(false);
    }
  }, [item.id, filtered, type, from, to]);

  useEffect(() => { void load(); }, [load]);

  if (error) return <InlineAlert kind="error" title="Historial" message={error} />;

  return (
    <section className="bo-panel" aria-label="Historial de movimientos" data-ui="stock-item-history">
      <form
        className="bo-stockToolbar"
        aria-label="Filtros de historial"
        data-ui="stock-item-history-filters"
        data-testid="stock-item-history-filters"
        onSubmit={(event) => { event.preventDefault(); void load(); }}
      >
        <FormField label="Tipo" htmlFor="stock-history-type" className="bo-stockFilterField">
          <Select
            value={type}
            onChange={(value) => setType(value)}
            options={TYPE_OPTIONS}
            size="sm"
            ariaLabel="Filtrar por tipo de movimiento"
            data-testid="stock-history-type"
          />
        </FormField>
        <FormField label="Desde" htmlFor="stock-history-from" className="bo-stockFilterField">
          <input
            id="stock-history-from"
            className="bo-input"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setFrom(event.target.value)}
            data-ui="stock-history-from"
            data-testid="stock-history-from"
          />
        </FormField>
        <FormField label="Hasta" htmlFor="stock-history-to" className="bo-stockFilterField">
          <input
            id="stock-history-to"
            className="bo-input"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setTo(event.target.value)}
            data-ui="stock-history-to"
            data-testid="stock-history-to"
          />
        </FormField>
        {filtered ? (
          <button
            type="button"
            className="bo-btn bo-btnGhost"
            onClick={() => { setType(""); setFrom(""); setTo(""); }}
            data-ui="stock-history-clear"
            data-testid="stock-history-clear"
          >
            Limpiar filtros
          </button>
        ) : null}
      </form>
      <div className="bo-panelBody" data-ui="stock-item-history-body">
        {loading ? (
          <LoadingSpinner centered size="sm" label="Cargando historial…" />
        ) : movements.length === 0 ? (
          <EmptyState
            icon={<History size={32} aria-hidden="true" />}
            title={filtered ? "Sin resultados" : "Sin movimientos"}
            description={filtered
              ? "No hay movimientos que coincidan con los filtros aplicados."
              : "Aún no hay movimientos registrados para este artículo."}
            data-ui="stock-item-history-empty"
          />
        ) : (
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
                {movement.expiresAt ? <p className="bo-stockNote" data-ui="stock-item-history-expiry">Caducidad: {new Date(movement.expiresAt).toLocaleDateString("es-ES")}</p> : null}
                {movement.wasteReason ? <p className="bo-stockNote" data-ui="stock-item-history-reason">Motivo: {movement.wasteReason}</p> : null}
                {movement.note ? <p className="bo-stockNote" data-ui="stock-item-history-note">{movement.note}</p> : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
