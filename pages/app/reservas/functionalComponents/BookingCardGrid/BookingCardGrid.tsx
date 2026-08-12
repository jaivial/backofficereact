import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Trash2, ReceiptText, Clock, Users } from "lucide-react";
import type { Booking } from "../../../../../api/types";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../../../ui/lib/format";

// ponytail: "delete" maps to reserva cancel (soft-delete); reservas have no hard-delete endpoint.
type Props = {
  booking: Booking;
  onOpenDetails: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onCrearFactura: (b: Booking) => void;
  onSaveTable: (b: Booking, value: string) => Promise<boolean>;
};

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

function normalizeTableNumber(v: string): string {
  const raw = String(v || "").trim();
  if (!raw) return "";
  return raw.replace(/^mesa\b[\s#:\-]*/i, "").trim();
}

export const BookingCard = React.memo(function BookingCard({
  booking,
  onOpenDetails,
  onEdit,
  onCancel,
  onCrearFactura,
  onSaveTable,
}: Props) {
  const arroz = useMemo(
    () => formatArrozShort(booking.arroz_type, booking.arroz_servings),
    [booking.arroz_servings, booking.arroz_type],
  );
  const added = useMemo(() => formatAddedDate(booking.added_date), [booking.added_date]);
  const confirmed = booking.status === "confirmed";

  const [draftMesa, setDraftMesa] = useState<string>(() => normalizeTableNumber(booking.table_number || ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraftMesa(normalizeTableNumber(booking.table_number || ""));
  }, [booking.table_number]);

  const saveTable = useCallback(async () => {
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

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <article
      className="bo-bookingCard"
      data-slot="reservas-booking-card"
      data-booking-id={booking.id}
      onClick={() => onOpenDetails(booking)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetails(booking); } }}
    >
      <header className="bo-bookingCardHead" data-slot="reservas-booking-card-head">
        <div className="bo-bookingCardWho" data-slot="reservas-booking-card-who">
          <span className="bo-bookingCardName" data-slot="reservas-booking-card-name">{booking.customer_name}</span>
          <div className="bo-bookingCardMeta" data-slot="reservas-booking-card-meta">
            <span className="bo-bookingCardChip" data-slot="reservas-booking-card-chip">
              <Clock size={18} strokeWidth={1.8} aria-hidden="true" data-slot="reservas-booking-card-chip-icon" />
              <span className="bo-bookingCardChipValue" data-slot="reservas-booking-card-chip-value">{formatHHMM(booking.reservation_time)}</span>
              <span className="bo-bookingCardChipLabel" data-slot="reservas-booking-card-chip-label">hora</span>
            </span>
            <span className="bo-bookingCardChip" data-slot="reservas-booking-card-chip">
              <Users size={18} strokeWidth={1.8} aria-hidden="true" data-slot="reservas-booking-card-chip-icon" />
              <span className="bo-bookingCardChipValue" data-slot="reservas-booking-card-chip-value">{booking.party_size}</span>
              <span className="bo-bookingCardChipLabel" data-slot="reservas-booking-card-chip-label">pax</span>
            </span>
          </div>
        </div>
        <span className={`bo-bookingCardStatus bo-badge bo-badge--sm ${confirmed ? "bo-badge--success" : "bo-badge--warn"}`} data-slot="reservas-booking-card-status">
          {confirmed ? "Confirmada" : "Pendiente"}
        </span>
      </header>

      <dl className="bo-bookingCardGrid" data-slot="reservas-booking-card-grid">
        <div className="bo-bookingCardRow" data-slot="reservas-booking-card-row">
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Mesa</dt>
            <dd>
              <input
                className="bo-input bo-input--xs bo-input--mesa"
                value={draftMesa}
                onChange={(e) => setDraftMesa(e.target.value)}
                onBlur={() => void saveTable()}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                disabled={saving}
                aria-label={`Mesa reserva #${booking.id}`}
                data-testid={`reservas-card-mesa-${booking.id}`}
              />
            </dd>
          </div>
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Niños</dt><dd>{booking.children ?? 0}</dd>
          </div>
        </div>
        <div className="bo-bookingCardRow" data-slot="reservas-booking-card-row">
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Carros</dt><dd>{booking.babyStrollers ?? 0}</dd>
          </div>
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Tronas</dt><dd>{booking.highChairs ?? 0}</dd>
          </div>
        </div>
        <div className="bo-bookingCardRow" data-slot="reservas-booking-card-row">
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Teléfono</dt><dd>{formatPhone(booking.contact_phone_country_code, booking.contact_phone) || "—"}</dd>
          </div>
          <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
            <dt>Añadida</dt><dd>{added || "—"}</dd>
          </div>
        </div>
        <div className="bo-bookingCardRow" data-slot="reservas-booking-card-row">
          <div className="bo-bookingCardField bo-bookingCardField--wide" data-slot="reservas-booking-card-field">
            <dt>Arroz</dt><dd>{arroz || "—"}</dd>
          </div>
        </div>
        {booking.commentary ? (
          <div className="bo-bookingCardRow" data-slot="reservas-booking-card-row">
            <div className="bo-bookingCardField bo-bookingCardField--full" data-slot="reservas-booking-card-field">
              <dt>Comentario</dt><dd>{booking.commentary}</dd>
            </div>
          </div>
        ) : null}
      </dl>

      <footer className="bo-bookingCardActions" data-slot="reservas-booking-card-actions" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={stop(() => onOpenDetails(booking))} title="Ver" data-testid={`reservas-card-view-${booking.id}`}>
          <Eye size={16} strokeWidth={1.8} /> <span>Ver</span>
        </button>
        <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={stop(() => onEdit(booking))} title="Editar" data-testid={`reservas-card-edit-${booking.id}`}>
          <Pencil size={16} strokeWidth={1.8} /> <span>Editar</span>
        </button>
        <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger" onClick={stop(() => onCancel(booking))} title="Eliminar" data-testid={`reservas-card-delete-${booking.id}`}>
          <Trash2 size={16} strokeWidth={1.8} /> <span>Eliminar</span>
        </button>
        <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={stop(() => onCrearFactura(booking))} title="Crear factura" data-testid={`reservas-card-factura-${booking.id}`}>
          <ReceiptText size={16} strokeWidth={1.8} /> <span>Factura</span>
        </button>
      </footer>
    </article>
  );
});

export function BookingCardGrid({
  bookings,
  busy,
  onOpenDetails,
  onEdit,
  onCancel,
  onCrearFactura,
  onSaveTable,
}: {
  bookings: Booking[];
  busy: boolean;
  onOpenDetails: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onCrearFactura: (b: Booking) => void;
  onSaveTable: (b: Booking, value: string) => Promise<boolean>;
}) {
  if (!bookings.length) {
    return (
      <div className="bo-bookingCardsEmpty" data-slot="reservas-booking-cards-empty">
        {busy ? "Cargando..." : "No hay reservas para este filtro."}
      </div>
    );
  }
  return (
    <div className="bo-bookingCards" data-slot="reservas-booking-cards">
      {bookings.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          onOpenDetails={onOpenDetails}
          onEdit={onEdit}
          onCancel={onCancel}
          onCrearFactura={onCrearFactura}
          onSaveTable={onSaveTable}
        />
      ))}
    </div>
  );
}
