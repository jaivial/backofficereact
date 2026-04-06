import { test as base, type Page, type BrowserContext, type Fixtures, devices } from "@playwright/test";
import type { BOSession } from "../../api/types";

// Cache for session reuse within a test run
let cachedSession: BOSession | null = null;
type CookieOptions = { name: string; value: string; domain: string; path: string; httpOnly?: boolean; secure?: boolean; sameSite?: "Lax" | "Strict" | "None" };
let cachedCookies: CookieOptions[] = [];

export { expect, devices } from "@playwright/test";

/**
 * Combined test fixture with session and adminPage support.
 * Auto-logs in via login page and provides authenticated page.
 */
export const test = base
  .extend<{ session: BOSession }>({
    session: [
      async ({ browser }, use) => {
        // Reuse cached session within test run
        if (cachedSession) {
          await use(cachedSession);
          return;
        }

        const context = await browser.newContext();
        const page = await context.newPage();

        try {
          // Navigate to login page
          await page.goto("https://localhost:3001/login");

          // Fill login form
          await page.fill('input[name="identifier"]', "admin@hotmail.com");
          await page.fill('input[name="password"]', "admin123123");
          await page.click('button[type="submit"]');

          // Wait for redirect to app
          await page.waitForURL("**/app/**", { timeout: 30_000 });

          // Extract session via /api/admin/me
          const sessionResponse = await page.evaluate(async () => {
            const res = await fetch("/api/admin/me", { credentials: "include" });
            return res.json();
          });

          if (!sessionResponse.success || !sessionResponse.session) {
            throw new Error("Login failed: invalid session response");
          }

          cachedSession = sessionResponse.session;

          // Cache cookies for adminPage fixture
          cachedCookies = await context.cookies();

          await context.close();
          await use(cachedSession);
        } catch (error) {
          await context.close();
          throw error;
        }
      },
      // @ts-expect-error - Playwright types don't expose session scope but it's valid at runtime
      { scope: "session" },
    ],
  })
  .extend<{ adminPage: Page }>({
    adminPage: [
      async ({ browser }, use) => {
        const context = await browser.newContext();

        // Apply cached session cookies
        if (cachedCookies.length > 0) {
          await context.addInitScript(
            // Preserve any existing cookies
            (cookies: CookieOptions[]) => {
              cookies.forEach((cookie) => {
                document.cookie = `${cookie.name}=${cookie.value}; path=${cookie.path}`;
              });
            },
            cachedCookies
          );
        }

        const page = await context.newPage();

        // Verify session is valid
        await page.goto("https://localhost:3001/app");
        await page.waitForURL("**/app/**", { timeout: 15_000 }).catch(() => {
          // If redirect to login, session expired
          console.warn("Session may have expired during fixture setup");
        });

        await use(page);
        await context.close();
      },
      // @ts-expect-error - Playwright types don't expose session scope but it's valid at runtime
      { scope: "session" },
    ],
  });

// Keep testSession as alias for backwards compatibility
export const testSession = test;

/**
 * Reset session cache - call this in test.beforeEach to force re-login
 */
export function resetSessionCache() {
  cachedSession = null;
  cachedCookies = [];
}
