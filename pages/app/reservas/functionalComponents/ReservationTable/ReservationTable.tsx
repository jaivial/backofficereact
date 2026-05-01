import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Pencil, XCircle } from "lucide-react";
import { DropdownMenu } from "../../../../../ui/inputs/DropdownMenu";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../../../ui/lib/format";
import type { Booking } from "../../../../../api/types";

function normalizeTableNumber(v: string): string {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/^mesa\b[\s#:\-]*/i, "").trim();
}

function formatAddedDate(ts: string | null | undefined): string {
  if (!ts) return "";
  const s = String(ts).trim();
  if (!s.includes(" ")) return s;
  const [d, t] = s.split(" ");
  const [y, m, dd] = d.split("-");
  const hhmm = (t || "").slice(0, 5);
  if (dd && m) return `${dd}/${m} ${hhmm}`;
  return s;
}

interface ReservationTableProps {
  rows: Booking[];
  page: number;
  totalPages: number;
  totalCount: number;
  busy: boolean;
  onPageChange: (page: number) => void;
  onCancel: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onOpenDetails: (b: Booking) => void;
  onSaveTable: (b: Booking, value: string) => Promise<boolean>;
}

const BookingRow = React.memo(function BookingRow({
  booking,
  onCancel,
  onEdit,
  onOpenDetails,
  onSaveTable,
  busy,
}: {
  booking: Booking;
  onCancel: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onOpenDetails: (b: Booking) => void;
  onSaveTable: (b: Booking, value: string) => Promise<boolean>;
  busy: boolean;
}) {
  const arroz = useMemo(() => formatArrozShort(booking.arroz_type, booking.arroz_servings), [booking.arroz_servings, booking.arroz_type]);
  const added = useMemo(() => formatAddedDate(booking.added_date), [booking.added_date]);

  const [draftMesa, setDraftMesa] = useState<string>(() => normalizeTableNumber(booking.table_number || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftMesa(normalizeTableNumber(booking.table_number || ""));
  }, [booking.table_number]);

  const save = useCallback(async () => {
    const next = normalizeTableNumber(draftMesa);
    const cur = normalizeTableNumber(booking.table_number || "");
    if (next === cur) {
      if (draftMesa !== next) setDraftMesa(next);
      return;
    }
    setSaving(true);
    try {
      const ok = await onSaveTable(booking, next);
      if (!ok) setDraftMesa(cur);
    } finally {
      setSaving(false);
    }
  }, [booking, draftMesa, onSaveTable]);

  return (
    <tr
      onClick={() => {
        if (typeof window === "undefined") return;
        if (!window.matchMedia("(max-width: 760px)").matches) return;
        onOpenDetails(booking);
      }}
      data-ui="reservation-row"
    >
      <td className="col-added" data-ui="cell-added">{added}</td>
      <td className="col-mesa" data-ui="cell-mesa" onClick={(e) => e.stopPropagation()}>
        <input
          className="bo-input bo-input--xs bo-input--mesa"
          value={draftMesa}
          onChange={(e) => setDraftMesa(e.target.value)}
          onBlur={() => void save()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          disabled={busy || saving}
          aria-label={`Mesa reserva #${booking.id}`}
          data-ui="mesa-input"
        />
      </td>
      <td className="col-time" data-ui="cell-time">{formatHHMM(booking.reservation_time)}</td>
      <td className="col-client" data-ui="cell-client">{booking.customer_name}</td>
      <td className="col-status" data-ui="cell-status">{booking.status === "confirmed" ? "Confirmada" : "Pendiente"}</td>
      <td className="num" data-ui="cell-pax">{booking.party_size}</td>
      <td className="col-children num" data-ui="cell-children">{booking.children ?? 0}</td>
      <td className="col-phone" data-ui="cell-phone">{formatPhone(booking.contact_phone_country_code, booking.contact_phone)}</td>
      <td className="col-rice" data-ui="cell-rice">{arroz}</td>
      <td className="col-comment" data-ui="cell-comment">{booking.commentary || ""}</td>
      <td className="end" data-ui="cell-actions" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu
          label="Acciones"
          items={[
            { id: "details", label: "Reserva completa", onSelect: () => onOpenDetails(booking), icon: <FileText size={16} strokeWidth={1.8}> },
            { id: "edit", label: "Editar", onSelect: () => onEdit(booking), icon: <Pencil size={16} strokeWidth={1.8}> },
            { id: "cancel", label: "Cancelar", tone: "danger", onSelect: () => onCancel(booking), icon: <XCircle size={16} strokeWidth={1.8}> },
          ]}
        />
      </td>
    </tr>
  );
});

export function ReservationTable({
  rows,
  page,
  totalPages,
  totalCount,
  busy,
  onPageChange,
  onCancel,
  onEdit,
  onOpenDetails,
  onSaveTable,
}: ReservationTableProps) {
  const showPagerBtns = totalPages > 1;

  return (
    <div className="bo-tableWrap" style={{ marginTop: 14 }} data-ui="reservation-table-wrapper">
      <div className="bo-tableScroll" data-ui="table-scroll">
        <table className="bo-table bo-table--reservas" aria-label="Tabla de reservas" data-ui="reservations-table">
          <thead data-ui="table-header">
            <tr data-slot="reservationTable-tr">
              <th className="col-added" data-ui="th-added">Añadida</th>
              <th className="col-mesa" data-ui="th-mesa">Mesa</th>
              <th className="col-time" data-ui="th-time">Hora</th>
              <th className="col-client" data-ui="th-client">Cliente</th>
              <th className="col-status" data-ui="th-status">Estado</th>
              <th className="num" data-ui="th-pax">Pax</th>
              <th className="col-children num" data-ui="th-children">Niños</th>
              <th className="col-phone" data-ui="th-phone">Teléfono</th>
              <th className="col-rice" data-ui="th-rice">Arroz</th>
              <th className="col-comment" data-ui="th-comment">Comentario</th>
              <th className="end" data-ui="th-actions" />
            </tr>
          </thead>
          <tbody data-ui="table-body">
            {rows.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                onCancel={onCancel}
                onEdit={onEdit}
                onOpenDetails={onOpenDetails}
                onSaveTable={onSaveTable}
                busy={busy}
              />
            ))}
            {!rows.length ? (
              <tr data-ui="empty-row">
                <td colSpan={11} style={{ padding: 16, color: "var(--bo-muted)" }} data-ui="empty-cell">
                  {busy ? "Cargando..." : "No hay reservas para este filtro."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className={`bo-pager${showPagerBtns ? "" : " is-solo"}`} aria-label="Paginación" data-ui="pagination">
        <div className="bo-pagerText" data-ui="pager-text">
          Página {page} de {totalPages} · {totalCount} resultados
        </div>
        {showPagerBtns ? (
          <div className="bo-pagerBtns" data-ui="pager-buttons">
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={busy || page <= 1}
              data-ui="prev-page-btn"
            >
              Anterior
            </button>
            <button
              className="bo-btn bo-btn--ghost"
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={busy || page >= totalPages}
              data-ui="next-page-btn"
            >
              Siguiente
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
