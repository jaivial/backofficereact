import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { POSCashDayBilling, POSCashDayBillingTable } from "../../../../../api/types";
import { money } from "../../utils/money";
import { POSDialog } from "./POSDialog";

const METHOD_LABELS: Array<{ key: keyof POSCashDayBilling["byMethod"]; label: string }> = [
  { key: "CASH", label: "Efectivo" },
  { key: "CARD", label: "Tarjeta" },
  { key: "BANK", label: "Transferencia" },
  { key: "OTHER", label: "Otros" },
];

const CHANNEL_LABELS: Record<string, string> = { BAR: "Barra", TAKEAWAY: "Para llevar", DELIVERY: "Delivery", DINE_IN: "Sin mesa" };

function tableLabel(table: POSCashDayBillingTable): string {
  if (table.tableId !== null && table.tableName) return table.tableName;
  if (table.tableId !== null) return `Mesa ${table.tableId}`;
  return CHANNEL_LABELS[table.channel] ?? table.channel;
}

/** Share of `part` in `total` as a whole percentage; 0 when there is nothing to share. */
function share(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * "Facturación del día": total across every table of the business date (open
 * or closed tickets), how much of it is already closed, and how the closed
 * part was charged per payment method. Read-only; safe on a sealed day.
 */
export function POSDayBillingDialog({ date, onClose }: { date: string; onClose: () => void }) {
  const [data, setData] = useState<POSCashDayBilling | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await createClient().pos.cashDays.billing({ date });
      if (id !== requestId.current) return;
      if (!response.success) throw new Error(response.message || "No se pudo cargar la facturación.");
      setData(response);
    } catch (reason) {
      if (id !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : "No se pudo cargar la facturación.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
    // Drop any in-flight answer once the dialog unmounts.
    return () => { requestId.current += 1; };
  }, [load]);

  const closedShare = data ? share(data.closedCents, data.totalCents) : 0;

  return (
    <POSDialog testId="pos-billing" title="Facturación del día" error={error} onClose={onClose}>
      <div className="pos-billing" aria-busy={loading} data-testid="pos-billing-body">
        {!data && loading ? <p className="pos-modal__empty" data-testid="pos-billing-loading">Cargando…</p> : null}
        {data ? (
          <>
            <section className="pos-billing__hero" aria-label="Total facturado" data-testid="pos-billing-total-card">
              <span className="pos-billing__eyebrow">Total en mesas</span>
              <strong className="pos-billing__total" data-testid="pos-billing-total">{money(data.totalCents)}</strong>
              <div className="pos-billing__bar" role="img" aria-label={`${closedShare}% cerrado`} data-testid="pos-billing-bar">
                <span className="pos-billing__barFill" style={{ width: `${closedShare}%` }} />
              </div>
              <dl className="pos-billing__split">
                <div className="pos-billing__splitItem pos-billing__splitItem--closed">
                  <dt>Cerrado</dt>
                  <dd data-testid="pos-billing-closed">{money(data.closedCents)}</dd>
                  <small>{data.closedTickets} cuenta(s) cobrada(s)</small>
                </div>
                <div className="pos-billing__splitItem pos-billing__splitItem--open">
                  <dt>Pendiente</dt>
                  <dd data-testid="pos-billing-open">{money(data.openCents)}</dd>
                  <small>{data.openTables} mesa(s) abierta(s)</small>
                </div>
              </dl>
            </section>

            <section className="pos-billing__section" aria-labelledby="pos-billing-methods-title" data-testid="pos-billing-methods">
              <h3 id="pos-billing-methods-title" className="pos-billing__heading">Cerrado por método de pago</h3>
              <ul className="pos-billing__methods">
                {METHOD_LABELS.map(({ key, label }) => (
                  <li className="pos-billing__method" key={key} data-testid={`pos-billing-method-${key}`}>
                    <span className="pos-billing__methodLabel">{label}</span>
                    <span className="pos-billing__methodShare">{share(data.byMethod[key], data.closedCents)}%</span>
                    <strong className="pos-billing__methodValue">{money(data.byMethod[key])}</strong>
                  </li>
                ))}
              </ul>
              {data.tipsCents > 0 ? <p className="pos-billing__note" data-testid="pos-billing-tips">Propinas aparte: {money(data.tipsCents)}</p> : null}
            </section>

            <section className="pos-billing__section" aria-labelledby="pos-billing-tables-title" data-testid="pos-billing-tables">
              <h3 id="pos-billing-tables-title" className="pos-billing__heading">Por mesa</h3>
              {data.tables.length === 0 ? (
                <p className="pos-modal__empty" data-testid="pos-billing-tables-empty">Aún no hay mesas en este día.</p>
              ) : (
                <ul className="pos-billing__tables">
                  {data.tables.map((table) => (
                    <li className="pos-billing__table" key={`${table.tableId ?? "none"}-${table.channel}`} data-testid="pos-billing-table">
                      <span className="pos-billing__tableName">{tableLabel(table)}</span>
                      <span className={table.open ? "pos-billing__status pos-billing__status--open" : "pos-billing__status"}>{table.open ? "Abierta" : "Cerrada"}</span>
                      <strong className="pos-billing__tableValue">{money(table.totalCents)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="pos-billing__actions">
              <button className="pos-modal__secondary" type="button" onClick={() => void load()} disabled={loading} data-testid="pos-billing-refresh">
                <RefreshCw className="pos-billing__refreshIcon" aria-hidden="true" data-testid="pos-billing-refresh-icon" />
                {loading ? "Actualizando…" : "Actualizar"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </POSDialog>
  );
}
