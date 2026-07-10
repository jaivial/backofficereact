import {
  test as base,
  type Page,
  expect,
  devices,
} from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import type { BOSession } from "../../api/types";

const SESSION_CACHE_FILE = "test-results/.session-cache.json";

export { expect, devices };

interface CachedSession {
  bo_session: string;
  expiresAt: number;
}

/**
 * Main test fixture with admin session support.
 * Reads the session cookie from the global-setup cache file.
 */
export const test = base
  .extend<{ adminPage: Page; session: BOSession }>({
    adminPage: async ({ browser }, use) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });

      // Read session from global-setup cache
      let sessionCookie: string | null = null;
      if (fs.existsSync(SESSION_CACHE_FILE)) {
        try {
          const raw = fs.readFileSync(SESSION_CACHE_FILE, "utf-8");
          const cached: CachedSession = JSON.parse(raw);
          if (cached.expiresAt && Date.now() < cached.expiresAt) {
            sessionCookie = cached.bo_session;
          }
        } catch {
          // ignore
        }
      }

      if (sessionCookie) {
        await context.addCookies([{
          name: "bo_session",
          value: sessionCookie,
          domain: new URL(process.env.BACKOFFICE_URL || "https://localhost:3001").hostname,
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "Lax",
        }]);
      }

      const page = await context.newPage();
      await use(page);
      await context.close();
    },
    session: async ({}, use) => {
      // Return session data by calling /api/admin/me
      await use({
        user: {
          id: 3,
          email: "admin@hotmail.com",
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
  // Delete the cache file to force re-login on next run
  if (fs.existsSync(SESSION_CACHE_FILE)) {
    fs.unlinkSync(SESSION_CACHE_FILE);
  }
}
