import type {
  BookingSpecial,
  BookingSpecialAdelantoByMethod,
  BookingSpecialMenu,
  SpecialDateMenu,
  SpecialDatePaymentMethod,
  SpecialDateSettings,
} from "./types";

/**
 * Live totals for the special booking editor — mirrors the Go helper in the
 * backend (SPEC §3 computed fields). Used for live form feedback before the
 * snapshot reaches the server. Treat numbers as EUR with two decimals.
 *
 * Coordination id: special_booking_v1 (crosses FE/BE).
 */

export type DraftSpecialMenu = {
  /** Backend-issued id (special_date_menus.id) — required for the API payload. */
  special_date_menu_id: number;
  /** Reused active menu id (null for custom menus). */
  menu_id: number | null;
  /** True for custom (image) menus that have no principales to pick. */
  is_custom: boolean;
  label: string;
  unit_price: number;
  count: number;
  adelanto_per_unit: number;
  /** Selected payment method for this menu's adelanto. Null when not required. */
  adelanto_payment_method: SpecialDatePaymentMethod | null;
  /** Selected principal dishes with their servings (non-custom menus only). */
  items: Array<{ dish_id: number; name: string }>;
};

export type DraftAdelantoPaid = {
  method: SpecialDatePaymentMethod;
  amount: number;
};

/**
 * Resolved per-menu view used by the editor — combines the static
 * `SpecialDateSettings.menus` with the user's draft counts/items/payment-method.
 */
export type DraftSpecialMenuView = SpecialDateMenu & {
  draft: DraftSpecialMenu;
};

export type SpecialTotals = {
  required_total: number;
  paid_total: number;
  pending_total: number;
  status: "paid" | "pending";
  by_method: BookingSpecialAdelantoByMethod[];
  amount_left: number;
  /** True when the editor should disable the submit button due to invalid totals. */
  invalid: boolean;
};

const EMPTY: SpecialTotals = {
  required_total: 0,
  paid_total: 0,
  pending_total: 0,
  status: "paid",
  by_method: [],
  amount_left: 0,
  invalid: false,
};

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Build a per-method map from a list of partial advances (the editor inputs).
 * Skips zero / negative entries to avoid noise in the table.
 */
function paidByMethod(paid: DraftAdelantoPaid[] | undefined): Map<SpecialDatePaymentMethod, number> {
  const map = new Map<SpecialDatePaymentMethod, number>();
  if (!Array.isArray(paid)) return map;
  for (const p of paid) {
    if (!p || !p.method) continue;
    const amt = Number(p.amount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    map.set(p.method, (map.get(p.method) || 0) + amt);
  }
  return map;
}

function requiredByMethod(menus: DraftSpecialMenu[]): Map<SpecialDatePaymentMethod, number> {
  const map = new Map<SpecialDatePaymentMethod, number>();
  for (const m of menus) {
    if (!m || !m.adelanto_payment_method) continue;
    const amt = round2(Number(m.adelanto_per_unit || 0) * Number(m.count || 0));
    if (amt <= 0) continue;
    const k = m.adelanto_payment_method;
    map.set(k, round2((map.get(k) || 0) + amt));
  }
  return map;
}

/**
 * Compute the full breakdown shown in the editor and submitted with the
 * booking. When `partySize` is provided we also validate that the sum of menu
 * counters equals party size (SPEC §5.5).
 */
export function computeSpecialTotals(input: {
  menus: DraftSpecialMenu[];
  adelantos_paid?: DraftAdelantoPaid[];
  partySize?: number;
}): SpecialTotals {
  const menus = Array.isArray(input.menus) ? input.menus : [];
  const paidMap = paidByMethod(input.adelantos_paid);
  const reqMap = requiredByMethod(menus);

  const methodKeys = new Set<SpecialDatePaymentMethod>([...reqMap.keys(), ...paidMap.keys()]);
  const by_method: BookingSpecialAdelantoByMethod[] = [];
  let required_total = 0;
  let paid_total = 0;
  for (const method of methodKeys) {
    const required = reqMap.get(method) || 0;
    const paid = paidMap.get(method) || 0;
    const pending = round2(required - paid);
    required_total += required;
    paid_total += paid;
    by_method.push({ method, required: round2(required), paid: round2(paid), pending });
  }
  by_method.sort((a, b) => a.method.localeCompare(b.method));

  const pending_total = round2(Math.max(0, required_total - paid_total));
  const required_total_r = round2(required_total);
  const paid_total_r = round2(paid_total);
  const status: "paid" | "pending" = pending_total > 0 ? "pending" : "paid";

  const amount_left = round2(
    menus.reduce((acc, m) => acc + Number(m.unit_price || 0) * Number(m.count || 0), 0) - paid_total,
  );

  let invalid = false;
  if (typeof input.partySize === "number" && Number.isFinite(input.partySize) && input.partySize > 0) {
    const sumCount = menus.reduce((acc, m) => acc + (Number(m.count) || 0), 0);
    if (sumCount !== input.partySize) invalid = true;
  }

  return {
    required_total: required_total_r,
    paid_total: paid_total_r,
    pending_total,
    status,
    by_method,
    amount_left,
    invalid,
  };
}

export function emptySpecialTotals(): SpecialTotals {
  return { ...EMPTY, by_method: [] };
}

/**
 * Seed an editor draft's menu list from the special date settings — keeps the
 * canonical ordering and zero counts so the user just fills in counters.
 */
export function draftMenusFromSettings(menus: SpecialDateMenu[] | undefined): DraftSpecialMenu[] {
  if (!Array.isArray(menus)) return [];
  return menus
    .slice()
    .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((m) => ({
      special_date_menu_id: Number(m.id || 0),
      menu_id: m.menu_id ? Number(m.menu_id) : null,
      is_custom: !m.menu_id,
      label: m.menu_id ? "" : String(m.custom_title || ""),
      unit_price: 0,
      count: 0,
      adelanto_per_unit: Number(m.adelanto_amount || 0),
      adelanto_payment_method: null,
      items: [],
    }));
}

/**
 * Build a `BookingSpecial` shape from the editor draft + the live totals, used
 * to hydrate the grid columns without an extra round-trip. Mirrors the server
 * computed fields in SPEC §3.
 */
export function buildBookingSpecial(args: {
  title: string;
  is_prereserva: boolean;
  menus: DraftSpecialMenu[];
  totals: SpecialTotals;
}): BookingSpecial {
  const menus: BookingSpecialMenu[] = args.menus
    .filter((m) => Number(m.count || 0) > 0)
    .map((m) => ({
      special_date_menu_id: Number(m.special_date_menu_id || 0),
      menu_id: m.is_custom ? null : null,
      label: String(m.label || ""),
      unit_price: round2(Number(m.unit_price || 0)),
      count: Number(m.count || 0),
      adelanto_per_unit: round2(Number(m.adelanto_per_unit || 0)),
      adelanto_payment_method: m.adelanto_payment_method,
      items: m.items.map((it) => ({ dish_id: Number(it.dish_id || 0), name: String(it.name || "") })),
    }));
  return {
    title: String(args.title || ""),
    is_prereserva: Boolean(args.is_prereserva),
    menus,
    adelanto_required_total: args.totals.required_total,
    adelanto_paid_total: args.totals.paid_total,
    adelanto_pending_total: args.totals.pending_total,
    adelanto_status: args.totals.status,
    adelanto_by_method: args.totals.by_method,
    amount_left: args.totals.amount_left,
  };
}

/**
 * Helper used by the editor's per-menu principales validation: returns true
 * when the sum of the user's selected principales servings for `menuDraft`
 * equals the menu's counter. Custom menus return true (no rows required).
 */
export function principalesMatchCounter(menuDraft: DraftSpecialMenu): boolean {
  if (menuDraft.is_custom) return true;
  const sum = menuDraft.items.reduce((acc, it) => acc + (Number(it?.name ? 1 : 0)), 0);
  // We rely on servings === 1 per row (UI uses InlineCounter per dish row).
  // Sum counts the rows that have a dish assigned and matches the counter.
  return sum === Number(menuDraft.count || 0);
}

/**
 * Convenience: pull the available payment methods from the special date
 * settings, falling back to an empty list when missing.
 */
export function availablePaymentMethods(settings: SpecialDateSettings | null | undefined): SpecialDatePaymentMethod[] {
  if (!settings) return [];
  return Array.isArray(settings.adelanto_payment_methods) ? settings.adelanto_payment_methods : [];
}
