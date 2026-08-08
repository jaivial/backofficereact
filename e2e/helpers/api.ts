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
 */
export async function pickBookingDates(
  page: Page
): Promise<{ withBookings: string; empty: string }> {
  const now = new Date();
  const past: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    past.push(isoDate(d));
  }

  let withBookings = past[0];
  for (const date of past) {
    const data = (await apiGet(page, `/api/admin/bookings?date=${date}&page=1&count=1`)) as BookingsDay;
    if (data.success && (data.total_count ?? 0) > 0) {
      withBookings = date;
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

  return { withBookings, empty };
}
