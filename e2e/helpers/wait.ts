/**
 * Wait helpers for E2E tests.
 */
import type { Page, Response } from "@playwright/test";

/**
 * Wait for an API call to complete and return the response.
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number }
): Promise<Response> {
  return page.waitForResponse(
    (resp) => {
      const url = resp.url();
      const matches =
        typeof urlPattern === "string"
          ? url.includes(urlPattern)
          : urlPattern.test(url);
      return matches;
    },
    { timeout: options?.timeout || 15_000 }
  );
}

/**
 * Wait for a loading spinner/skeleton to disappear.
 */
export async function waitForLoadingToFinish(page: Page) {
  // Wait for common loading indicators to disappear
  const loadingSelectors = [
    '[data-testid="loading"]',
    '[data-ui="loading"]',
    '.animate-spin',
    '.skeleton',
    '[role="progressbar"]',
  ];

  for (const selector of loadingSelectors) {
    const el = page.locator(selector);
    if ((await el.count()) > 0) {
      await el.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
    }
  }
}

/**
 * Wait for the page to be idle (no network activity for a period).
 */
export async function waitForIdle(page: Page, idleMs = 500) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(idleMs);
}

/**
 * Wait for a URL to change to match a pattern.
 */
export async function waitForURLMatch(
  page: Page,
  pattern: string | RegExp,
  timeout = 15_000
) {
  await page.waitForURL(pattern, { timeout });
}
