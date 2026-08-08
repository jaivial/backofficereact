/**
 * Direct API helpers for E2E tests
 * Use these to set up test data without UI interactions.
 */
import type { Page } from "@playwright/test";
import type { BOSession } from "../../api/types";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3001";

function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Direct API helpers for E2E tests.
 * Use the page's request context (shares browser cookies, no CORS — works
 * even before the page has navigated).
 */
export async function apiGet(
  page: Page,
  path: string,
  _session?: BOSession
): Promise<Record<string, unknown>> {
  const res = await page.request.get(absoluteUrl(path));
  return res.json();
}

export async function apiPost(
  page: Page,
  path: string,
  body: Record<string, unknown>,
  _session?: BOSession
): Promise<Record<string, unknown>> {
  const res = await page.request.post(absoluteUrl(path), { data: body });
  return res.json();
}

/** Fecha ISO local (YYYY-MM-DD) para una Date dada. */
export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type BookingsDay = { success?: boolean; total_count?: number };

/**
 * Busca dinámicamente una fecha con reservas y una fecha sin reservas en la DB
 * de dev, para que los tests no dependan de fechas hardcodeadas.
 * hasBookings=false si ninguna fecha reciente tiene reservas.
 */
export async function pickBookingDates(
  page: Page
): Promise<{ withBookings: string; empty: string; hasBookings: boolean }> {
  const now = new Date();
  const past: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    past.push(isoDate(d));
  }

  let withBookings = past[0];
  let hasBookings = false;
  for (const date of past) {
    const data = (await apiGet(page, `/api/admin/bookings?date=${date}&page=1&count=1`)) as BookingsDay;
    if (data.success && (data.total_count ?? 0) > 0) {
      withBookings = date;
      hasBookings = true;
      break;
    }
  }

  let empty = isoDate(now);
  for (let i = 1; i <= 60; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const date = isoDate(d);
    const data = (await apiGet(page, `/api/admin/bookings?date=${date}&page=1&count=1`)) as BookingsDay;
    if (data.success && (data.total_count ?? 0) === 0) {
      empty = date;
      break;
    }
  }

  return { withBookings, empty, hasBookings };
}

/** Orden de paneles de tipo de menú (mismo orden que MENU_TYPE_ORDER en la app). */
export const MENU_TYPE_ORDER = [
  "closed_conventional",
  "closed_group",
  "a_la_carte",
  "a_la_carte_group",
  "special",
];

type GroupMenusV2 = { success?: boolean; menus?: { menu_type?: string }[] };

/**
 * Elige dinámicamente un tipo de menú que tenga al menos un menú en la DB de dev,
 * para que los tests de Menus no dependan de un tipo concreto con datos.
 */
export async function pickMenuTypeWithItems(
  page: Page
): Promise<{ type: string; hasItems: boolean; count: number }> {
  const data = (await apiGet(page, "/api/admin/group-menus-v2?includeDrafts=1")) as GroupMenusV2;
  const menus = Array.isArray(data.menus) ? data.menus : [];
  if (!data.success || menus.length === 0) {
    return { type: MENU_TYPE_ORDER[0], hasItems: false, count: 0 };
  }
  const counts = new Map<string, number>();
  for (const m of menus) {
    const t = m.menu_type || MENU_TYPE_ORDER[0];
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  // Prioriza el orden de la app; si ningún panel tiene menús, usa el primero
  for (const type of MENU_TYPE_ORDER) {
    if ((counts.get(type) ?? 0) > 0) {
      return { type, hasItems: true, count: counts.get(type) ?? 0 };
    }
  }
  return { type: MENU_TYPE_ORDER[0], hasItems: false, count: 0 };
}

type ComidaList = { success?: boolean; items?: { num?: number; nombre?: string }[]; total?: number };

/**
 * Consulta un ítem de comida (por defecto platos) para el test de detalle.
 * Devuelve el primer id encontrado; hasItems=false si la carta está vacía.
 */
export async function pickFoodItem(
  page: Page,
  foodType = "platos"
): Promise<{ hasItems: boolean; itemId?: number; itemName?: string }> {
  const data = (await apiGet(page, `/api/admin/${foodType}?page=1&limit=1`)) as ComidaList;
  const items = Array.isArray(data.items) ? data.items : [];
  if (!data.success || items.length === 0) {
    return { hasItems: false };
  }
  return { hasItems: true, itemId: items[0].num, itemName: items[0].nombre };
}
