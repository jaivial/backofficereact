import React, { useMemo } from "react";
import { formatArrozShort, formatHHMM, formatPhone } from "../../../../../ui/lib/format";
import type { Booking, ConfigFloor } from "../../../../../api/types";
import { Panel } from "../../../../../ui/shell/Panel";
import { bookingFloorDisplay, bookingSalonDisplay } from "../../bookingLocation";

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

function statusLabel(status: string | null | undefined): string {
  if (status === "confirmed") return "Confirmada";
  if (status === "pending") return "Pendiente";
  return status ? String(status) : "—";
}

interface BookingDetailsPanelProps {
  booking: Booking;
  floors: ConfigFloor[];
}

export function BookingDetailsPanel({ booking, floors }: BookingDetailsPanelProps) {
  const arroz = formatArrozShort(booking.arroz_type, booking.arroz_servings);
  const added = formatAddedDate(booking.added_date);
  const time = formatHHMM(booking.reservation_time);
  const phone = formatPhone(booking.contact_phone_country_code, booking.contact_phone);
  const status = statusLabel(booking.status);
  const preferredFloorLabel = useMemo(() => bookingFloorDisplay(booking, floors) || "—", [booking, floors]);
  const preferredSalonLabel = bookingSalonDisplay(booking) || "—";
  const badgeCls =
    booking.status === "confirmed"
      ? "bo-badge bo-badge--ok"
      : booking.status === "pending"
        ? "bo-badge bo-badge--warn"
        : "bo-badge";

  return (
    <div className="bo-stack" style={{ gap: 12, marginBottom: "2rem" }} data-ui="booking-details-panel">
      <div className="bo-panel" data-ui="main-info-panel">
        <div className="bo-panelHead" data-ui="panel-header">
          <div className="bo-panelTitle" data-ui="customer-name">{booking.customer_name || "Reserva"}</div>
          <div className="bo-panelMeta" data-ui="reservation-date">{booking.reservation_date}</div>
        </div>
        <div className="bo-panelBody" style={{ display: "grid", gap: 12 }} data-ui="panel-body">
          <div className="bo-bookingKey" aria-label="Hora y personas" data-ui="key-facts">
            <div data-ui="time-info">
              <div className="bo-bookingKeyLabel" data-ui="time-label">Hora</div>
              <div className="bo-bookingKeyValue" data-ui="time-value">{time || "—"}</div>
            </div>
            <div data-ui="pax-info">
              <div className="bo-bookingKeyLabel" data-ui="pax-label">Personas</div>
              <div className="bo-bookingKeyValue" data-ui="pax-value">{booking.party_size} pax</div>
            </div>
          </div>

          <div className="bo-kvGrid" aria-label="Datos principales" data-ui="kv-grid">
            <div className="bo-kv" data-ui="kv-status">
              <div className="bo-kvLabel" data-ui="kv-label">Estado</div>
              <div className="bo-kvValue" data-ui="kv-value">
                <span className={badgeCls} data-ui="status-badge">{status}</span>
              </div>
            </div>
            <div className="bo-kv" data-ui="kv-table">
              <div className="bo-kvLabel" data-ui="kv-label">Mesa</div>
              <div className="bo-kvValue" data-ui="kv-value">{normalizeTableNumber(booking.table_number || "") || "—"}</div>
            </div>
            <div className="bo-kv" data-ui="kv-added">
              <div className="bo-kvLabel" data-ui="kv-label">Añadida</div>
              <div className="bo-kvValue" data-ui="kv-value">{added || "—"}</div>
            </div>
            <div className="bo-kv" data-ui="kv-phone">
              <div className="bo-kvLabel" data-ui="kv-label">Teléfono</div>
              <div className="bo-kvValue" data-ui="kv-value">{phone || "—"}</div>
            </div>
            <div className="bo-kv" data-ui="kv-floor">
              <div className="bo-kvLabel" data-ui="kv-label">Planta</div>
              <div className="bo-kvValue" data-ui="kv-value">{preferredFloorLabel}</div>
            </div>
            <div className="bo-kv" data-ui="kv-salon">
              <div className="bo-kvLabel" data-ui="kv-label">Salón</div>
              <div className="bo-kvValue" data-ui="kv-value">{preferredSalonLabel}</div>
            </div>
            <div className="bo-kv" data-ui="kv-children">
              <div className="bo-kvLabel" data-ui="kv-label">Niños</div>
              <div className="bo-kvValue" data-ui="kv-value">{String(booking.children ?? 0)}</div>
            </div>
          </div>
        </div>
      </div>

      <Panel data-ui="details-panel" title="Detalles" meta={booking.special_menu ? "Menú de grupo" : "Reserva"}>
        <div className="bo-kvGrid" data-ui="kv-grid">
          <div className="bo-kv bo-kv--wide" data-ui="kv-email">
            <div className="bo-kvLabel" data-ui="kv-label">Email</div>
            <div className="bo-kvValue bo-kvValue--wrap" data-ui="kv-value">{booking.contact_email || "—"}</div>
          </div>
          <div className="bo-kv" data-ui="kv-strollers">
            <div className="bo-kvLabel" data-ui="kv-label">Carros</div>
            <div className="bo-kvValue" data-ui="kv-value">{typeof booking.babyStrollers === "number" ? String(booking.babyStrollers) : "—"}</div>
          </div>
          <div className="bo-kv" data-ui="kv-chairs">
            <div className="bo-kvLabel" data-ui="kv-label">Tronas</div>
            <div className="bo-kvValue" data-ui="kv-value">{typeof booking.highChairs === "number" ? String(booking.highChairs) : "—"}</div>
          </div>
          <div className="bo-kv bo-kv--wide" data-ui="kv-arroz">
            <div className="bo-kvLabel" data-ui="kv-label">Arroz</div>
            <div className="bo-kvValue" data-ui="kv-value">{arroz || "—"}</div>
          </div>
        </div>
      </Panel>

      <div className="bo-panel" data-ui="commentary-panel">
        <div className="bo-panelHead" data-ui="panel-header">
          <div className="bo-panelTitle" data-ui="panel-title">Comentario</div>
          <div className="bo-panelMeta" data-ui="panel-meta">Opcional</div>
        </div>
        <div className="bo-panelBody" style={{ whiteSpace: "pre-line" }} data-ui="panel-body">
          {booking.commentary ? booking.commentary : <span className="bo-mutedText" data-ui="no-commentary">—</span>}
        </div>
      </div>
    </div>
  );
}
