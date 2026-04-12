/**
 * Playwright Component Testing (CT) fixtures.
 *
 * These fixtures wrap the standard Playwright test with app-specific context:
 * - Cookie injection for authenticated sessions
 * - Theme support
 * - Viewport variants
 *
 * Usage in CT tests:
 *   import { test } from "./ct-fixtures";
 *   test("renders FoodItemCard with session", async ({ mount, sessionPage }) => {
 *     await sessionPage.addCookies([...]);
 *     // ...
 *   });
 *
 * OR use the simpler approach with test.withCookies():
 *   test.withCookies([{ name: "bo_session", value: session, domain: "localhost", ... }])
 */

import { test as base, type Page, type Locator } from "@playwright/test";

// ---------------------------------------------------------------------------
// Session cookie from global setup
// ---------------------------------------------------------------------------

function getCTSession(): string {
  const session = (global as any).__ctSession;
  if (!session) {
    throw new Error(
      "[ct-fixtures] No CT session found. Did global-setup-ct.ts run? " +
        "Make sure to use this fixture in tests run via: " +
        "npx playwright test -c playwright.ct-config.ts"
    );
  }
  return session;
}

// ---------------------------------------------------------------------------
// Extended test with CT-specific fixtures
// ---------------------------------------------------------------------------

export interface CTSessionPage extends Page {
  /**
   * Adds the seeded admin session cookie to this page.
   * Call this BEFORE mounting components that need auth context.
   */
  withAdminSession: () => Promise<void>;
}

export const test = base.extend<{
  /**
   * A page that automatically has the admin session cookie injected.
   * Use this for testing components that depend on Jotai session atoms.
   *
   * Usage:
   *   const page = await sessionPage();
   *   await page.goto("/app/comida/platos");
   *   // page already has session cookie
   */
  sessionPage: () => Promise<CTSessionPage>;
}>({
  sessionPage: async ({ browser }): Promise<CTSessionPage> => {
    const session = getCTSession();

    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: undefined, // Don't use storage state, use cookies directly
    });

    // Inject session cookie
    await context.addCookies([
      {
        name: "bo_session",
        value: session,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);

    const page = await context.newPage() as CTSessionPage;

    page.withAdminSession = async () => {
      // Already injected via context cookies — no-op for convenience
      await Promise.resolve();
    };

    return page;
  },
});

export const { expect } = base;
