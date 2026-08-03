import {
  test as base,
  type Page,
  expect,
  devices,
} from "@playwright/test";
import type { BOSession } from "../../api/types";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

export { expect, devices };
export type { Page } from "@playwright/test";

/**
 * Main test fixture with admin session support.
 * Reads the session cookie from the global-setup cache file.
 */
export const test = base
  .extend<{ adminPage: Page; session: BOSession }>({
    adminPage: async ({ browser }, use) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const baseURL = process.env.BACKOFFICE_URL || `https://localhost:${process.env.PORT || "3001"}`;
      await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded" });
      const login = await page.evaluate(async ({ email, password }) => {
        const response = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ identifier: email, password }),
        });
        return { ok: response.ok, body: await response.json() };
      }, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
      if (!login.ok || !login.body?.success) {
        throw new Error(`Fixture login failed: ${login.body?.message || "unknown error"}`);
      }
      await use(page);
      await context.close();
    },
    session: async ({}, use) => {
      // Return session data by calling /api/admin/me
      await use({
        user: {
          id: 3,
          email: ADMIN_EMAIL,
          name: "Admin",
          role: "root",
          roleImportance: 100,
          sectionAccess: [
            "ajustes", "comida", "estado_cuenta", "facturas",
            "fichaje", "horarios", "menus", "miembros",
            "reportes", "reservas", "site-builder", "website",
          ],
          mustChangePassword: false,
        },
        restaurants: [{ id: 1, slug: "villacarmen", name: "Alqueria Villa Carmen" }],
        activeRestaurantId: 1,
      } as BOSession);
    },
  });

export const testSession = test;

export function resetSessionCache() {
  // Kept for callers that reset auth state between suites. Fixtures log in per context.
}
