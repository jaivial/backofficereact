import type {
  Booking,
  BookingExtra,
  BookingSpecial,
  GroupMenu,
  GroupMenuSummary,
  SpecialDatePaymentMethod,
} from "../../../../../api/types";
import type { DraftAdelantoPaid, DraftSpecialMenu } from "../../../../../api/specialBookingHelpers";

export type RiceRow = { type: string; servings: number };
export type PrincipalesRow = { name: string; servings: number };

function normalizeToArray(raw: string | null): any[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null") return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
  }
  return [s];
}

function normalizeToIntArray(raw: string | null): number[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s || s.toLowerCase() === "null") return [];
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    } catch {
      // ignore
    }
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? [n] : [];
}

export function arrozRowsFromBooking(b: Booking): RiceRow[] {
  const types = normalizeToArray(b.arroz_type).map((x) => String(x ?? "").trim()).filter(Boolean);
  const servs = normalizeToIntArray(b.arroz_servings);
  const n = Math.min(types.length, servs.length);
  const out: RiceRow[] = [];
  for (let i = 0; i < n; i++) {
    const t = types[i] || "";
    const s = servs[i] || 0;
    if (!t || s <= 0) continue;
    out.push({ type: t, servings: s });
  }
  return out;
}

export function principalesRowsFromBooking(b: Booking): PrincipalesRow[] {
  const raw = String(b.principales_json || "").trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => ({ name: String(x?.name ?? "").trim(), servings: Number(x?.servings ?? 0) }))
      .filter((x) => x.name && Number.isFinite(x.servings) && x.servings > 0);
  } catch {
    return [];
  }
}

export function principalesItemsFromMenu(menu: GroupMenu | null): string[] {
  const items = (menu as any)?.principales?.items;
  if (!Array.isArray(items)) return [];
  return items.map((x) => String(x ?? "").trim()).filter(Boolean);
}

// Coordination id: booking_extras_v1
export function extrasFromBooking(b: Booking): BookingExtra[] {
  if (Array.isArray(b.extras)) {
    return b.extras
      .map((extra) => ({ id: Number(extra?.id || 0), slug: String(extra?.slug || ""), name: String(extra?.name || "").trim() }))
      .filter((extra) => extra.id > 0 && extra.name);
  }
  const raw = String(b.extras_json || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((extra) => ({ id: Number(extra?.id || 0), slug: String(extra?.slug || ""), name: String(extra?.name || "").trim() }))
      .filter((extra) => extra.id > 0 && extra.name);
  } catch {
    return [];
  }
}

export function findMenuTitle(summaries: GroupMenuSummary[], id: number | null | undefined): string {
  if (!id) return "";
  const m = summaries.find((x) => x.id === id);
  return m ? String(m.menu_title || "") : "";
}

/**
 * Hydrate the editor's per-menu draft from the booking's special snapshot.
 * Used when editing a booking that was created on a special date (SPEC §5.5).
 * Coordination id: special_booking_v1.
 */
export function specialMenusFromBooking(special: BookingSpecial | null | undefined): {
  menus: DraftSpecialMenu[];
  adelantos_paid: DraftAdelantoPaid[];
} {
  const menus: DraftSpecialMenu[] = Array.isArray(special?.menus)
    ? special!.menus.map((m) => ({
        special_date_menu_id: Number(m.special_date_menu_id || 0),
        menu_id: m.menu_id ? Number(m.menu_id) : null,
        is_custom: !m.menu_id,
        label: String(m.label || ""),
        unit_price: Number(m.unit_price || 0),
        count: Number(m.count || 0),
        adelanto_per_unit: Number(m.adelanto_per_unit || 0),
        adelanto_payment_method: (m.adelanto_payment_method || null) as SpecialDatePaymentMethod | null,
        items: Array.isArray(m.items)
          ? m.items.map((it) => ({ dish_id: Number(it.dish_id || 0), name: String(it.name || "") }))
          : [],
      }))
    : [];
  // The server stores adelantos_paid under `special_json.adelantos_paid` but
  // exposes only the computed `adelanto_by_method` in the booking response.
  // For the edit form we seed per-method amounts from that breakdown so the
  // user sees the current paid totals and can adjust them.
  const adelantos_paid: DraftAdelantoPaid[] = Array.isArray(special?.adelanto_by_method)
    ? special!.adelanto_by_method
        .filter((row) => Number(row.paid) > 0)
        .map((row) => ({ method: row.method as SpecialDatePaymentMethod, amount: Number(row.paid || 0) }))
    : [];
  return { menus, adelantos_paid };
}
