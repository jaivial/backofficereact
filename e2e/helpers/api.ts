/**
 * Direct API helpers for E2E tests
 * Use these to set up test data without UI interactions.
 */
import type { Page } from "@playwright/test";
import type { BOSession } from "../../api/types";

export async function apiGet(
  page: Page,
  path: string,
  session: BOSession
): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ([path, sessionCookie]) => {
      // Build cookie header
      const cookie = `bo_session=${sessionCookie || ""}`;
      const res = await fetch(path, {
        headers: { cookie },
        credentials: "include",
      });
      return res.json();
    },
    [path, ""]
  );
}

export async function apiPost(
  page: Page,
  path: string,
  body: Record<string, unknown>,
  session?: BOSession
): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ([p, b]: [string, Record<string, unknown>]) => {
      const res = await fetch(p, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(b),
      });
      return res.json();
    },
    [path, body] as [string, Record<string, unknown>]
  );
}
