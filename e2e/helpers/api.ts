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
