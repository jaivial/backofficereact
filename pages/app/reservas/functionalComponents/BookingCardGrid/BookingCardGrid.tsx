import React, { useMemo } from "react";
import { Eye, Pencil, Trash2, ReceiptText } from "lucide-react";
import type { Booking } from "../../../../../api/types";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../../../ui/lib/format";

// ponytail: "delete" maps to reserva cancel (soft-delete); reservas have no hard-delete endpoint.
type Props = {
  booking: Booking;
  onOpenDetails: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onCrearFactura: (b: Booking) => void;
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

export const BookingCard = React.memo(function BookingCard({
  booking,
  onOpenDetails,
  onEdit,
  onCancel,
  onCrearFactura,
}: Props) {
  const arroz = useMemo(
    () => formatArrozShort(booking.arroz_type, booking.arroz_servings),
    [booking.arroz_servings, booking.arroz_type],
  );
  const added = useMemo(() => formatAddedDate(booking.added_date), [booking.added_date]);
  const confirmed = booking.status === "confirmed";

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
          <span className="bo-bookingCardTime" data-slot="reservas-booking-card-time">{formatHHMM(booking.reservation_time)} · {booking.party_size} pax</span>
        </div>
        <span className={`bo-badge bo-badge--sm ${confirmed ? "bo-badge--success" : "bo-badge--warn"}`} data-slot="reservas-booking-card-status">
          {confirmed ? "Confirmada" : "Pendiente"}
        </span>
      </header>

      <dl className="bo-bookingCardGrid" data-slot="reservas-booking-card-grid">
        <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
          <dt>Mesa</dt><dd>{booking.table_number || "—"}</dd>
        </div>
        <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
          <dt>Niños</dt><dd>{booking.children ?? 0}</dd>
        </div>
        <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
          <dt>Teléfono</dt><dd>{formatPhone(booking.contact_phone_country_code, booking.contact_phone) || "—"}</dd>
        </div>
        <div className="bo-bookingCardField" data-slot="reservas-booking-card-field">
          <dt>Añadida</dt><dd>{added || "—"}</dd>
        </div>
        <div className="bo-bookingCardField bo-bookingCardField--wide" data-slot="reservas-booking-card-field">
          <dt>Arroz</dt><dd>{arroz || "—"}</dd>
        </div>
        {booking.commentary ? (
          <div className="bo-bookingCardField bo-bookingCardField--full" data-slot="reservas-booking-card-field">
            <dt>Comentario</dt><dd>{booking.commentary}</dd>
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
}: {
  bookings: Booking[];
  busy: boolean;
  onOpenDetails: (b: Booking) => void;
  onEdit: (b: Booking) => void;
  onCancel: (b: Booking) => void;
  onCrearFactura: (b: Booking) => void;
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
        />
      ))}
    </div>
  );
}
