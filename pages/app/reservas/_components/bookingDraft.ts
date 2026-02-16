import type { Booking, GroupMenu, GroupMenuSummary } from "../../../../api/types";

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

export function findMenuTitle(summaries: GroupMenuSummary[], id: number | null | undefined): string {
  if (!id) return "";
  const m = summaries.find((x) => x.id === id);
  return m ? String(m.menu_title || "") : "";
}

