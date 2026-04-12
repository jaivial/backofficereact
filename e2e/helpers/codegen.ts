import type { Page } from "@playwright/test";

// Global session injected by the Playwright e2e fixture / seed script.
declare const __e2eSession__: string;

interface WithSessionOptions {
  /** Override the cookie value. Defaults to global __e2eSession__. */
  sessionToken?: string;
}

/**
 * Injects the `bo_session` cookie into the given page context,
 * simulating a logged-in backoffice session.
 *
 * Usage:
 * ```ts
 * test("my test", async ({ page }) => {
 *   await withSession(page);
 *   await page.goto("/app/dashboard");
 * });
 * ```
 */
export async function withSession(
  page: Page,
  options: WithSessionOptions = {}
): Promise<void> {
  const token =
    options.sessionToken ?? (typeof __e2eSession__ !== "undefined" ? __e2eSession__ : "");
  await page.context().addCookies([
    {
      name: "bo_session",
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Returns a Playwright test template string generated from a trace file.
 *
 * The output can be pasted into a `.spec.ts` file and adjusted manually.
 *
 * Usage:
 * ```ts
 * const template = generateTestFromTrace("/path/to/trace.zip");
 * console.log(template);
 * ```
 */
export function generateTestFromTrace(tracePath: string): string {
  return `import { test, expect, type Page } from "@playwright/test";

/**
 * Generated from trace: ${tracePath}
 * Review and adjust selectors before committing.
 */

// TODO: replace with real URL or use page.goto('') then navigate.
const BASE_URL = "https://localhost:3001";

test("generated test", async ({ page }: { page: Page }) => {
  // TODO: add withSession(page) if the page requires auth.

  await page.goto(BASE_URL);

  // TODO: replace with real selectors (use data-testid where possible).
  await page.waitForSelector("[data-testid='TODO']");

  // TODO: assert expected state.
  await expect(page.locator("body")).toBeVisible();
});
`;
}
