import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { POSCashDayCalendar } from "../../../../../ui/widgets/POSCashDayCalendar";
import { createClient } from "../../../../../api/client";
import type { POSCashDayTables } from "../../../../../api/types";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function monthOf(iso: string): { year: number; month: number } {
  const today = new Date();
  if (!iso) return { year: today.getFullYear(), month: today.getMonth() + 1 };
  const [y, m] = iso.split("-").map(Number);
  return y && m ? { year: y, month: m } : { year: today.getFullYear(), month: today.getMonth() + 1 };
}

export type POSCalendarModalProps = {
  open: boolean;
  onClose: () => void;
  activeDate: string;
  onChangeDate: (iso: string) => void;
};

/**
 * Month picker over past cash days. Selecting a day loads its per-table
 * breakdown (`tables()` endpoint); "Ir a este día" re-scopes the POS to it.
 * The modal itself is dismissable (Escape / outside-click), unlike the
 * unclosed-days gate.
 */
export function POSCalendarModal({ open, onClose, activeDate, onChangeDate }: POSCalendarModalProps) {
  const [{ year, month }, setMonth] = useState(() => monthOf(activeDate));
  const [selected, setSelected] = useState(activeDate);
  const [detail, setDetail] = useState<POSCashDayTables | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  // Keep the picker month in sync when the parent's active date moves.
  useEffect(() => { setMonth(monthOf(activeDate)); }, [activeDate]);

  useEffect(() => {
    if (!open) { setDetail(null); setDetailError(""); return; }
    setSelected(activeDate);
  }, [open, activeDate]);

  useEffect(() => {
    if (!open || !selected) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError("");
    void (async () => {
      try {
        const res = await api.pos.cashDays.tables({ date: selected });
        if (cancelled) return;
        if (res.success) setDetail(res);
        else { setDetail(null); setDetailError(res.message || "No se pudo cargar el detalle."); }
      } catch (reason) {
        if (!cancelled) { setDetail(null); setDetailError(reason instanceof Error ? reason.message : "No se pudo cargar el detalle."); }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, open, selected]);

  return (
    <Modal open={open} onClose={onClose} title="Calendario" size="lg" hideClose data-testid="pos-calendar-modal">
      <ModalHeader title="Calendario" onClose={onClose} data-testid="pos-calendar-header" />
      <div data-slot="pOSCalendarModal-pos-calendarModal-body" className="pos-calendarModal__body">
        <POSCashDayCalendar
          year={year}
          month={month}
          selectedDateISO={selected}
          onSelectDate={setSelected}
          onPrevMonth={() => setMonth((cur) => ({ year: cur.month === 1 ? cur.year - 1 : cur.year, month: cur.month === 1 ? 12 : cur.month - 1 }))}
          onNextMonth={() => setMonth((cur) => ({ year: cur.month === 12 ? cur.year + 1 : cur.year, month: cur.month === 12 ? 1 : cur.month + 1 }))}
        />
        <aside className="pos-calendarModal__detail" data-testid="pos-calendar-detail">
          <header data-testid="pos-calendarmodal-detailhead" className="pos-calendarModal__detailHead">
            <h3 data-testid="pos-calendar-detail-title">{selected || "Selecciona un día"}</h3>
            {detail?.readOnly ? <span className="pos-calendarModal__badge" data-testid="pos-calendar-readonly">Solo consulta</span> : null}
          </header>
          {detailError ? <p className="pos-calendarModal__error" role="alert" data-testid="pos-calendar-error">{detailError}</p> : null}
          {detailLoading ? <p className="pos-calendarModal__pending" role="status" data-testid="pos-calendar-loading">Cargando detalle…</p> : null}
          {!detailLoading && !detailError && detail ? (
            detail.tables.length ? (
              <ul className="pos-calendarModal__tables" data-testid="pos-calendar-tables">
                {detail.tables.map((t) => (
                  <li className="pos-calendarModal__table" key={t.tableId ?? t.tableName} data-testid={`pos-calendar-table-${t.tableId ?? t.tableName}`}>
                    <div data-slot="pOSCalendarModal-pos-calendarModal-tableHead" className="pos-calendarModal__tableHead">
                      <strong data-testid={`pos-calendar-table-name-${t.tableId ?? t.tableName}`}>{t.tableName || "Sin mesa"}</strong>
                      <span data-testid={`pos-calendar-table-total-${t.tableId ?? t.tableName}`}>{eur.format((t.totalGrossCents || 0) / 100)}</span>
                    </div>
                    <span className="pos-calendarModal__covers" data-testid={`pos-calendar-table-covers-${t.tableId ?? t.tableName}`}>{t.covers} comensales · {t.visits.length} visita(s)</span>
                    <ul data-slot="pOSCalendarModal-pos-calendarModal-visits" className="pos-calendarModal__visits">
                      {t.visits.map((v) => (
                        <li key={v.visitId} data-testid={`pos-calendar-visit-${v.visitId}`}>
                          <span data-slot="pOSCalendarModal-span">{v.channel === "BAR" ? "Barra" : v.channel} · {v.status === "OPEN" ? "Abierta" : "Cerrada"} · {v.tickets.length} ticket(s)</span>
                          <span data-testid={`pos-calendar-visit-total-${v.visitId}`}>{eur.format((v.totalGrossCents || 0) / 100)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : <p className="pos-calendarModal__empty" data-testid="pos-calendar-empty">Sin mesas ese día.</p>
          ) : null}
          <button
            className="pos-calendarModal__goto"
            type="button"
            disabled={!selected}
            onClick={() => { if (selected) { onChangeDate(selected); onClose(); } }}
            data-testid="pos-calendar-goto"
          >
            Ir a este día
          </button>
        </aside>
      </div>
    </Modal>
  );
}
