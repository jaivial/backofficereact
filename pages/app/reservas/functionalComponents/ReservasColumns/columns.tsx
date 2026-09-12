import React from "react";

import type { Booking } from "../../../../../api/types";
import { formatHHMM, formatPhone } from "../../../../../ui/lib/format";
import { bookingFloorDisplay, bookingSalonDisplay } from "../../bookingLocation";

/**
 * Single source of truth for the reservations table columns, shared by the
 * table renderer and the column-picker modal so the two can never drift.
 * Coordination id: reservas_columns_realtime_v1
 */
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
  | "phone"
  | "rice"
  | "comment";

export type ReservasColumnCtx = {
  added: string;
  arroz: string;
  draftMesa: string;
  onDraftMesaChange: (value: string) => void;
  onMesaBlur: () => void;
  mesaDisabled: boolean;
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
  { id: "status", label: "Estado", thClass: "col-status", cellClass: "col-status", hideBelowWidth: 980, render: (b) => (b.status === "confirmed" ? "Confirmada" : "Pendiente") },
  { id: "floor", label: "Planta", render: (b) => bookingFloorDisplay(b) || "—" },
  { id: "salon", label: "Salón", render: (b) => bookingSalonDisplay(b) || "—" },
  { id: "pax", label: "Pax", thClass: "num", cellClass: "num", render: (b) => b.party_size },
  { id: "children", label: "Niños", thClass: "col-children num", cellClass: "col-children num", hideBelowWidth: 1280, render: (b) => b.children ?? 0 },
  { id: "phone", label: "Teléfono", thClass: "col-phone", cellClass: "col-phone", hideBelowWidth: 1480, render: (b) => formatPhone(b.contact_phone_country_code, b.contact_phone) },
  { id: "rice", label: "Arroz", thClass: "col-rice", cellClass: "col-rice", render: (_b, c) => c.arroz },
  { id: "comment", label: "Comentario", thClass: "col-comment", cellClass: "col-comment", hideBelowWidth: 1680, render: (b) => b.commentary || "" },
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
