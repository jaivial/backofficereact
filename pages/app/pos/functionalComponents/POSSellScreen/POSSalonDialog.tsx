import React, { useCallback, useEffect, useMemo, useState } from "react";

import { POSDialog } from "./POSDialog";
import { money, request, type Reservation, type Table, type Ticket, type Visit } from "../../hooks/usePOSRegister";
import { SalonMap } from "../../../reservas/tables/functionalComponents/SalonMap/SalonMap";
import { normalizeTableKey, resolveAssignments } from "../../../reservas/tables/helpers/tables";
import type { BookingState } from "../../../reservas/tables/types/tables";
import { createClient } from "../../../../../api/client";
import type { Booking, TableMapItem } from "../../../../../api/types";

const INACTIVE_BOOKING = new Set(["cancelled", "canceled", "rejected", "no_show", "noshow"]);

/** A booking of the day placed on a table, merged with its POS link (visit). */
type TableBooking = { id: number; name: string; time: string; partySize: number; status: string; visitId: number | null };

/** What the salon popover can do; all of it runs the existing register flows. */
export type POSSalonActions = {
  /** Visit on screen, if any (taps then move it, as in the tables modal). */
  currentVisit: Visit | null;
  visits: Visit[];
  tables: Table[];
  busy: boolean;
  readOnly: boolean;
  /** Same flow as tapping a table tile: restore / move / select. */
  onSelectTable: (table: Table) => void;
  onOpenTable: (table: Table, covers: string, bookingId?: number) => Promise<boolean>;
};

/**
 * Full-page salon map of the POS. Tapping a table opens a popover next to it to
 * check its comanda, open it (optionally seating a booking) or manage the
 * table's bookings of the day. Coordination id: pos_salon_map_popover_v1
 */
export function POSSalonDialog({ date, actions, onClose }: { date: string; actions: POSSalonActions; onClose: () => void }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [linked, setLinked] = useState<Reservation[]>([]);
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});

  useEffect(() => {
    let alive = true;
    void api.reservas.exportDay(date).then((res) => { if (alive && res.success) setBookings(res.bookings || []); });
    void request<{ items: Reservation[] }>(`/reservations/eligible?date=${encodeURIComponent(date)}`)
      .then((data) => { if (alive) setLinked(data.items || []); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [api, date]);

  const onLayout = useCallback((layout: Record<string, unknown>) => {
    setBookingStates((layout.booking_states || {}) as Record<string, BookingState>);
  }, []);

  // Same table matching as the reservas map (multi-table assignments, legacy table_number).
  const bookingsForTable = useCallback((table: TableMapItem): TableBooking[] => {
    const keys = new Set([normalizeTableKey(table.name), normalizeTableKey(table.numero_mesa)].filter(Boolean));
    return bookings
      .filter((b) => !INACTIVE_BOOKING.has(String(b.status || "").toLowerCase()))
      .filter((b) => resolveAssignments(bookingStates[String(b.id)], b.table_number, b.party_size)
        .some((a) => a.table_id === table.id || keys.has(normalizeTableKey(a.table_name))))
      .map((b) => ({
        id: b.id,
        name: b.customer_name || `Reserva ${b.id}`,
        time: String(b.reservation_time || "").slice(0, 5),
        partySize: b.party_size,
        status: String(b.status || "pending"),
        visitId: linked.find((entry) => entry.id === b.id)?.visitId ?? null,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [bookingStates, bookings, linked]);

  const getStatus = useCallback((table: TableMapItem): TableMapItem["status"] => {
    if (actions.tables.find((entry) => entry.id === table.id)?.occupied) return "occupied";
    return bookingsForTable(table).some((b) => !b.visitId) ? "reserved" : "available";
  }, [actions.tables, bookingsForTable]);

  const renderPopover = useCallback((mapTable: TableMapItem, close: () => void) => (
    <POSSalonTablePopover
      key={mapTable.id}
      mapTable={mapTable}
      date={date}
      bookings={bookingsForTable(mapTable)}
      actions={actions}
      onDone={() => { close(); onClose(); }}
    />
  ), [actions, bookingsForTable, date, onClose]);

  return (
    <POSDialog testId="pos-salon" title="Salón" fullPage onClose={onClose}>
      <SalonMap date={date} testId="pos-salon-map" getStatus={getStatus} renderPopover={renderPopover} onLayout={onLayout} />
    </POSDialog>
  );
}

function POSSalonTablePopover({ mapTable, date, bookings, actions, onDone }: {
  mapTable: TableMapItem;
  date: string;
  bookings: TableBooking[];
  actions: POSSalonActions;
  onDone: () => void;
}) {
  const table = actions.tables.find((entry) => entry.id === mapTable.id) || null;
  const visit = table?.occupied ? actions.visits.find((entry) => entry.tableId === mapTable.id && entry.status !== "CLOSED") || null : null;
  const pendingBookings = bookings.filter((b) => !b.visitId);
  const [covers, setCovers] = useState("2");
  const [bookingId, setBookingId] = useState(0);
  const canAct = Boolean(table) && !actions.readOnly;
  const isCurrent = Boolean(visit && actions.currentVisit?.id === visit.id);
  const free = Boolean(table && !table.occupied);

  const open = (guests: string, booking?: number) => {
    if (!table) return;
    void actions.onOpenTable(table, guests, booking).then((ok) => { if (ok) onDone(); });
  };
  const id = mapTable.id;

  return (
    <div className="pos-salonPop" data-testid={`pos-salon-pop-${id}`}>
      <div className="pos-salonPop__head" data-testid={`pos-salon-pop-head-${id}`}>
        <h3 data-testid={`pos-salon-pop-title-${id}`}>Mesa {mapTable.name}</h3>
        <span className={`pos-salonPop__badge is-${table?.occupied ? "occupied" : pendingBookings.length ? "reserved" : "available"}`} data-testid={`pos-salon-pop-badge-${id}`}>
          {table?.occupied ? "Ocupada" : pendingBookings.length ? "Reservada" : "Libre"}
        </span>
      </div>
      <p className="pos-salonPop__meta" data-testid={`pos-salon-pop-meta-${id}`}>
        {mapTable.capacity} plazas{visit ? ` · ${visit.covers} comensales` : ""}
      </p>
      {!table ? <p className="pos-modal__empty" data-testid={`pos-salon-pop-unknown-${id}`}>Esta mesa no está dada de alta en el TPV.</p> : null}

      {visit ? <POSSalonComanda visit={visit} /> : null}
      {visit && canAct ? (
        <div className="pos-salonPop__actions" data-testid={`pos-salon-pop-visit-actions-${id}`}>
          {isCurrent ? (
            <button className="pos-modal__primary" type="button" onClick={onDone} data-testid={`pos-salon-pop-back-${id}`}>Volver a la comanda</button>
          ) : !actions.currentVisit ? (
            <button className="pos-modal__primary" type="button" disabled={actions.busy} onClick={() => { actions.onSelectTable(table!); onDone(); }} data-testid={`pos-salon-pop-restore-${id}`}>Abrir comanda</button>
          ) : (
            <p className="pos-modal__pending" data-testid={`pos-salon-pop-busy-note-${id}`}>Ya tienes {actions.currentVisit.tableName || "una comanda"} abierta.</p>
          )}
        </div>
      ) : null}

      {free && canAct && actions.currentVisit ? (
        <div className="pos-salonPop__actions" data-testid={`pos-salon-pop-move-actions-${id}`}>
          <button className="pos-modal__primary" type="button" disabled={actions.busy} onClick={() => { actions.onSelectTable(table!); onDone(); }} data-testid={`pos-salon-pop-move-${id}`}>
            Mover {actions.currentVisit.tableName || "comanda"} aquí
          </button>
        </div>
      ) : null}

      {free && canAct && !actions.currentVisit ? (
        <div className="pos-salonPop__section" data-testid={`pos-salon-pop-open-${id}`}>
          <h4 data-testid={`pos-salon-pop-open-title-${id}`}>Abrir mesa</h4>
          {pendingBookings.length ? (
            <label className="pos-modal__covers" data-testid={`pos-salon-pop-booking-field-${id}`}>Reserva
              <select value={bookingId} onChange={(event) => {
                const next = Number(event.target.value);
                setBookingId(next);
                const booking = pendingBookings.find((b) => b.id === next);
                if (booking) setCovers(String(booking.partySize));
              }} aria-label="Reserva" data-testid={`pos-salon-pop-booking-select-${id}`}>
                <option value={0}>Sin reserva</option>
                {pendingBookings.map((b) => <option key={b.id} value={b.id}>{`${b.time} · ${b.name} · ${b.partySize}`}</option>)}
              </select>
            </label>
          ) : null}
          <label className="pos-modal__covers" data-testid={`pos-salon-pop-covers-field-${id}`}>Comensales
            <input inputMode="numeric" value={covers} onChange={(event) => setCovers(event.target.value)} aria-label="Comensales" data-testid={`pos-salon-pop-covers-${id}`} />
          </label>
          <button className="pos-modal__primary" type="button" disabled={actions.busy} onClick={() => open(covers, bookingId || undefined)} data-testid={`pos-salon-pop-open-btn-${id}`}>
            Abrir {mapTable.name}
          </button>
        </div>
      ) : null}

      {bookings.length ? (
        <div className="pos-salonPop__section" data-testid={`pos-salon-pop-bookings-${id}`}>
          <h4 data-testid={`pos-salon-pop-bookings-title-${id}`}>Reservas de hoy ({bookings.length})</h4>
          {bookings.map((b) => (
            <div className="pos-salonPop__booking" key={b.id} data-testid={`pos-salon-pop-booking-${b.id}`}>
              <strong data-testid={`pos-salon-pop-booking-name-${b.id}`}>{b.time} · {b.name}</strong>
              <span className="pos-salonPop__meta" data-testid={`pos-salon-pop-booking-meta-${b.id}`}>
                {b.partySize} comensales · {b.visitId ? "Sentada" : b.status === "confirmed" ? "Confirmada" : "Pendiente"}
              </span>
              <div className="pos-salonPop__actions" data-testid={`pos-salon-pop-booking-actions-${b.id}`}>
                {!b.visitId && free && canAct && !actions.currentVisit ? (
                  <button className="pos-modal__primary" type="button" disabled={actions.busy} onClick={() => open(String(b.partySize), b.id)} data-testid={`pos-salon-pop-seat-${b.id}`}>Sentar</button>
                ) : null}
                <a className="pos-modal__secondary" href={`/app/reservas?date=${encodeURIComponent(date)}&edit=${b.id}`} target="_blank" rel="noopener noreferrer" data-testid={`pos-salon-pop-booking-edit-${b.id}`}>Ver en reservas</a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Read-only view of a visit's checks: lines, quantities, kitchen state and totals. */
function POSSalonComanda({ visit }: { visit: Visit }) {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setTickets(null); setError("");
    request<{ visit: Visit & { tickets: Ticket[] } }>(`/visits/${visit.id}`)
      .then((data) => { if (alive) setTickets((data.visit.tickets || []).filter((t) => t.status !== "VOIDED")); })
      .catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "No se pudo cargar la comanda"); });
    return () => { alive = false; };
  }, [visit.id]);

  const id = visit.id;
  if (error) return <p className="pos-modal__error" role="alert" data-testid={`pos-salon-comanda-error-${id}`}>{error}</p>;
  if (!tickets) return <p className="pos-modal__pending" role="status" data-testid={`pos-salon-comanda-loading-${id}`}>Cargando comanda...</p>;
  const total = tickets.reduce((sum, t) => sum + (t.totalGrossCents || 0), 0);

  return (
    <div className="pos-salonPop__section" data-testid={`pos-salon-comanda-${id}`}>
      <h4 data-testid={`pos-salon-comanda-title-${id}`}>Comanda</h4>
      {tickets.map((ticket) => {
        const lines = ticket.lines.filter((line) => line.status !== "VOIDED" && !line.parentLineId);
        return (
          <div className="pos-salonPop__section" key={ticket.id} data-testid={`pos-salon-comanda-ticket-${ticket.id}`}>
            {tickets.length > 1 ? <strong data-testid={`pos-salon-comanda-ticket-label-${ticket.id}`}>{ticket.guestLabel || ticket.ticketNumber || `Cuenta ${ticket.id}`}</strong> : null}
            {lines.length ? (
              <ul className="pos-salonPop__lines" data-testid={`pos-salon-comanda-lines-${ticket.id}`}>
                {lines.map((line) => {
                  const sent = Math.min(line.kitchenSentQuantity || 0, line.quantity);
                  const state = line.comped ? "Invitación" : sent >= line.quantity ? "En cocina" : sent > 0 ? `${sent}/${line.quantity} en cocina` : "Sin enviar";
                  return (
                    <li className={sent < line.quantity && !line.comped ? "pos-salonPop__line is-pending" : "pos-salonPop__line"} key={line.id} data-testid={`pos-salon-comanda-line-${line.id}`}>
                      <span data-testid={`pos-salon-comanda-line-qty-${line.id}`}>{line.quantity}×</span>
                      <span data-testid={`pos-salon-comanda-line-name-${line.id}`}>
                        {line.productName}
                        <span className="pos-salonPop__lineState" data-testid={`pos-salon-comanda-line-state-${line.id}`}>{state}</span>
                      </span>
                      <span data-testid={`pos-salon-comanda-line-total-${line.id}`}>{money(line.lineTotalGrossCents)}</span>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="pos-modal__empty" data-testid={`pos-salon-comanda-empty-${ticket.id}`}>Sin productos.</p>}
          </div>
        );
      })}
      <div className="pos-salonPop__total" data-testid={`pos-salon-comanda-total-${id}`}><span>Total</span><span>{money(total)}</span></div>
    </div>
  );
}
