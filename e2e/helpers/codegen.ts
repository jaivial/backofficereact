import type { Page } from "@playwright/test";

import { injectSessionCookie } from "./auth";

/**
 * @deprecated Use `injectSessionCookie` from helpers/auth.ts directly.
 *
 * Kept as a thin wrapper so existing callers keep working; it no longer relies
 * on the undefined global `__e2eSession__` that never existed.
 */
export async function withSession(
  page: Page,
  options: { sessionToken?: string } = {},
): Promise<void> {
  if (!options.sessionToken) {
    throw new Error(
      "withSession requires options.sessionToken (read it from the session cache or pass the bo_session value)",
    );
  }
  await injectSessionCookie(page, options.sessionToken);
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

test("generated test", async ({ page }: { page: Page }) => {
  // TODO: authenticate via the session fixture instead of manual login:
  //   import { test } from "../../fixtures/session";
  //   test("...", async ({ adminPage }) => { ... });

  await page.goto("/app");

  // TODO: replace with real selectors (use data-testid where possible).
  await page.waitForSelector("[data-testid='TODO']");

  // TODO: assert expected state.
  await expect(page.locator("body")).toBeVisible();
});
`;
}
