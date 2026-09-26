import React from "react";
import { Check, X } from "lucide-react";

import { SPECIAL_DATE_PAYMENT_METHOD_LABELS, type Booking, type BookingSpecial } from "../../../../../api/types";
import { StatusBadge } from "../../../../../ui/feedback/StatusBadge";
import { formatHHMM, formatPhone } from "../../../../../ui/lib/format";
import { bookingFloorDisplay, bookingSalonDisplay } from "../../bookingLocation";

/**
 * Single source of truth for the reservations table columns, shared by the
 * table renderer and the column-picker modal so the two can never drift.
 * Coordination id: reservas_columns_realtime_v1
 */

/**
 * Cells in this file are designed to render a clean null-dash when the
 * booking is not part of the special-date flow so they blend into the existing
 * reservations grid. Coordination id: special_booking_v1.
 */
const DASH = "—";

function isSpecial(b: Booking): b is Booking & { special: BookingSpecial } {
  return Boolean(b.special && Array.isArray(b.special.menus));
}

function formatEUR(n: number | null | undefined): string {
  if (!Number.isFinite(Number(n))) return DASH;
  return `${Number(n).toFixed(2)}€`;
}

export type ReservasColumnId =
  | "added"
  | "mesa"
  | "time"
  | "client"
  | "status"
  | "floor"
  | "salon"
  | "pax"
  | "children"
  | "highChairs"
  | "strollers"
  | "phone"
  | "rice"
  | "comment"
  | "adelantoEstado"
  | "adelantoTotal"
  | "adelantoDesglose"
  | "adelantoMetodos"
  | "menusEspeciales"
  | "movilidad"
  | "movilidadPax"
  | "pendiente"
  | "qrPdf";

export type ReservasColumnCtx = {
  added: string;
  arroz: string;
  draftMesa: string;
  onDraftMesaChange: (value: string) => void;
  onMesaBlur: () => void;
  mesaDisabled: boolean;
  /** Opens the QR / receipt modal. Coordination id: special_booking_qr_v1 */
  onOpenQr: () => void;
};

export type ReservasColumnDef = {
  id: ReservasColumnId;
  label: string;
  thClass?: string;
  cellClass?: string;
  /**
   * Viewport width (px) at or below which this column is hidden by default.
   * Single source of truth for the old CSS media breakpoints, so the picker's
   * initial state and the table always agree.
   */
  hideBelowWidth?: number;
  /** Whether the cell stops row-click bubbling (interactive cells like Mesa). */
  stopPropagation?: boolean;
  render: (booking: Booking, ctx: ReservasColumnCtx) => React.ReactNode;
};

export const RESERVAS_COLUMNS: ReservasColumnDef[] = [
  { id: "added", label: "Añadida", thClass: "col-added", cellClass: "col-added", hideBelowWidth: 1240, render: (_b, c) => c.added },
  {
    id: "mesa",
    label: "Mesa",
    thClass: "col-mesa",
    cellClass: "col-mesa",
    stopPropagation: true,
    render: (b, c) => (
      <input
        className="bo-input bo-input--xs bo-input--mesa"
        value={c.draftMesa}
        onChange={(e) => c.onDraftMesaChange(e.target.value)}
        onBlur={c.onMesaBlur}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        disabled={c.mesaDisabled}
        aria-label={`Mesa reserva #${b.id}`}
        data-testid={`reservas-page-mesa-${b.id}`}
      />
    ),
  },
  { id: "time", label: "Hora", thClass: "col-time", cellClass: "col-time", render: (b) => formatHHMM(b.reservation_time) },
  { id: "client", label: "Cliente", thClass: "col-client", cellClass: "col-client", render: (b) => b.customer_name },
  {
    id: "status",
    label: "Estado",
    thClass: "col-status",
    cellClass: "col-status",
    hideBelowWidth: 980,
    // Estado is rendered as a tick/cross icon (not text) so the table scans
    // faster at a glance. Coordination id: reservas_status_icons_v1
    render: (b) => {
      const confirmed = b.status === "confirmed";
      const label = confirmed ? "Confirmada" : "Pendiente";
      return (
        <span
          className={`bo-reservasStatus${confirmed ? " is-confirmed" : " is-pending"}`}
          role="img"
          aria-label={label}
          title={label}
          data-testid={`reservas-status-${b.id}`}
        >
          {confirmed
            ? <Check className="bo-ico" size={16} strokeWidth={2.4} aria-hidden="true" />
            : <X className="bo-ico" size={16} strokeWidth={2.4} aria-hidden="true" />}
        </span>
      );
    },
  },
  { id: "floor", label: "Planta", render: (b) => bookingFloorDisplay(b) || DASH },
  { id: "salon", label: "Salón", render: (b) => bookingSalonDisplay(b) || DASH },
  { id: "pax", label: "Pax", thClass: "num", cellClass: "num", render: (b) => b.party_size },
  { id: "children", label: "Niños", thClass: "col-children num", cellClass: "col-children num", hideBelowWidth: 1280, render: (b) => b.children ?? 0 },
  { id: "highChairs", label: "Tronas", thClass: "col-highChairs num", cellClass: "col-highChairs num", hideBelowWidth: 1280, render: (b) => b.highChairs ?? 0 },
  { id: "strollers", label: "Carros bebé", thClass: "col-strollers num", cellClass: "col-strollers num", hideBelowWidth: 1280, render: (b) => b.babyStrollers ?? 0 },
  { id: "phone", label: "Teléfono", thClass: "col-phone", cellClass: "col-phone", hideBelowWidth: 1480, render: (b) => formatPhone(b.contact_phone_country_code, b.contact_phone) },
  { id: "rice", label: "Arroz", thClass: "col-rice", cellClass: "col-rice", render: (_b, c) => c.arroz },
  { id: "comment", label: "Comentario", thClass: "col-comment", cellClass: "col-comment", hideBelowWidth: 1680, render: (b) => b.commentary || "" },
  // ─── Special booking columns (SPEC §5.4) — null-dash for non-special rows.
  // Only `adelantoEstado` is visible by default; the rest stay opt-in.
  // ─── Mobility (coordination id: mobility_day_override_v1). Answers exist
  // for every day whose question is active, not just special dates: rows
  // without data fall back to the dash.
  {
    id: "movilidad",
    label: "Problemas movilidad",
    thClass: "col-movilidad",
    cellClass: "col-movilidad",
    hideBelowWidth: 1480,
    render: (b) => {
      const has = Boolean(b.has_mobility_issues);
      if (!isSpecial(b) && !has && !Number(b.mobility_people || 0)) return DASH;
      return (
        <span
          className="bo-reservasColIcon"
          title={has ? "Con problemas de movilidad" : "Sin problemas de movilidad"}
          aria-label={has ? "Con problemas de movilidad" : "Sin problemas de movilidad"}
          data-testid={`reservas-movilidad-${b.id}`}
        >
          {has ? (
            <Check size={16} strokeWidth={2.2} className="text-[color:var(--bo-color-success)]" aria-hidden="true" />
          ) : (
            <X size={16} strokeWidth={2.2} className="text-[color:var(--bo-muted)]" aria-hidden="true" />
          )}
        </span>
      );
    },
  },
  {
    id: "movilidadPax",
    label: "Comensales movilidad",
    thClass: "col-movilidad-pax num",
    cellClass: "col-movilidad-pax num",
    hideBelowWidth: 1680,
    render: (b) => {
      if (!b.has_mobility_issues) return DASH;
      return b.mobility_people ?? 0;
    },
  },
  {
    id: "adelantoEstado",
    label: "Estado adelanto",
    thClass: "col-adelanto-estado",
    cellClass: "col-adelanto-estado",
    render: (b) => {
      if (!isSpecial(b)) return DASH;
      const paid = b.special.adelanto_status === "paid";
      return (
        <StatusBadge
          variant={paid ? "success" : "danger"}
          data-testid={`reservas-adelanto-estado-${b.id}`}
        >
          {paid ? "Pagado" : "Pendiente"}
        </StatusBadge>
      );
    },
  },
  {
    id: "adelantoTotal",
    label: "Adelanto total",
    thClass: "col-adelanto-total num",
    cellClass: "col-adelanto-total num",
    hideBelowWidth: 1480,
    render: (b) => (isSpecial(b) ? formatEUR(b.special.adelanto_required_total) : DASH),
  },
  {
    id: "adelantoDesglose",
    label: "Desglose adelanto",
    thClass: "col-adelanto-desglose",
    cellClass: "col-adelanto-desglose",
    hideBelowWidth: 1680,
    render: (b) => {
      if (!isSpecial(b)) return DASH;
      const rows = b.special.menus.filter((m) => Number(m.adelanto_per_unit) > 0 && Number(m.count) > 0);
      if (rows.length === 0) return DASH;
      return (
        <span className="bo-reservasColLines" data-testid={`reservas-adelanto-desglose-${b.id}`}>
          {rows.map((m, i) => (
            <span key={i} className="bo-reservasColLine" data-slot="reservas-adelanto-desglose-line">
              {m.label} {Number(m.adelanto_per_unit).toFixed(2)}€ x {m.count}
            </span>
          ))}
        </span>
      );
    },
  },
  {
    id: "adelantoMetodos",
    label: "Métodos de pago",
    thClass: "col-adelanto-metodos",
    cellClass: "col-adelanto-metodos",
    hideBelowWidth: 1680,
    render: (b) => {
      if (!isSpecial(b)) return DASH;
      const paidRows = b.special.adelanto_by_method.filter((m) => Number(m.paid) > 0);
      if (paidRows.length === 0) return DASH;
      return (
        <span className="bo-reservasColLines" data-testid={`reservas-adelanto-metodos-${b.id}`}>
          {paidRows.map((m, i) => (
            <span key={i} className="bo-reservasColLine" data-slot="reservas-adelanto-metodos-line">
              {Number(m.paid).toFixed(2)}€ {SPECIAL_DATE_PAYMENT_METHOD_LABELS[m.method] || m.method}
            </span>
          ))}
        </span>
      );
    },
  },
  {
    id: "menusEspeciales",
    label: "Menús especiales",
    thClass: "col-menus-especiales",
    cellClass: "col-menus-especiales",
    hideBelowWidth: 1680,
    render: (b) => {
      if (!isSpecial(b)) return DASH;
      const rows = b.special.menus.filter((m) => Number(m.count) > 0);
      if (rows.length === 0) return DASH;
      return (
        <span className="bo-reservasColLines" data-testid={`reservas-menus-especiales-${b.id}`}>
          {rows.map((m, i) => (
            <span key={i} className="bo-reservasColLine" data-slot="reservas-menus-especiales-line">
              {m.label} x {m.count}
            </span>
          ))}
        </span>
      );
    },
  },
  {
    id: "pendiente",
    label: "Pendiente",
    thClass: "col-pendiente num",
    cellClass: "col-pendiente num",
    hideBelowWidth: 1480,
    render: (b) => (isSpecial(b) ? formatEUR(b.special.amount_left) : DASH),
  },
  {
    // Coordination id: special_booking_qr_v1 - QR + Stripe receipt of a
    // special-date booking, opened in a modal (image / PDF preview).
    id: "qrPdf",
    label: "QR / PDF",
    thClass: "col-qr-pdf",
    cellClass: "col-qr-pdf",
    stopPropagation: true,
    render: (b, c) => (isSpecial(b) ? (
      <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={c.onOpenQr} data-testid={`reservas-qr-open-${b.id}`}>
        Ver qr/pdf
      </button>
    ) : DASH),
  },
];

export const RESERVAS_COLUMN_IDS: ReservasColumnId[] = RESERVAS_COLUMNS.map((c) => c.id);

/** Keeps only known ids, in canonical order. Unknown/stale ids are dropped. */
export function normalizeVisibleColumns(ids: readonly string[] | null | undefined): ReservasColumnId[] {
  const set = new Set(ids ?? []);
  return RESERVAS_COLUMN_IDS.filter((id) => set.has(id));
}

/** Parses the stored CSV preference; an unset value means every column. */
export function parseVisibleColumnsPreference(raw: string | null | undefined): ReservasColumnId[] {
  const value = String(raw ?? "").trim();
  if (!value) return [...RESERVAS_COLUMN_IDS];
  const parsed = normalizeVisibleColumns(value.split(","));
  return parsed.length > 0 ? parsed : [...RESERVAS_COLUMN_IDS];
}

/** Whether a stored preference is an explicit user choice (vs the default). */
export function hasVisibleColumnsPreference(raw: string | null | undefined): boolean {
  return String(raw ?? "").trim() !== "";
}

/**
 * Default visible columns for a viewport width, derived from the same
 * `hideBelowWidth` metadata the picker uses. This mirrors the legacy CSS media
 * breakpoints so the table looks identical before the user customizes it.
 */
export function defaultVisibleColumnsForWidth(width: number): ReservasColumnId[] {
  return RESERVAS_COLUMNS.filter((col) => !col.hideBelowWidth || width > col.hideBelowWidth).map((col) => col.id);
}
