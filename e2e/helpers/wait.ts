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

/**
 * Wait until React has hydrated the app.
 *
 * In dev (Vite) el HTML SSR aparece antes de que React hidrate: clicar
 * demasiado pronto dispara el click sobre un elemento sin handlers y la
 * acción no ocurre. Este helper espera a que los nodos del layout tengan
 * props de React (__reactFiber$) como señal de hidratación.
 */
export async function waitForHydration(page: Page, timeout = 25_000) {
  await page.waitForFunction(() => {
    const hasReactFiber = (node: Element): boolean =>
      Object.keys(node).some((k) => k.startsWith("__reactFiber"));
    const el = document.querySelector("#bo-portal");
    if (!el) return false;
    if (hasReactFiber(el)) return true;
    return Array.from(el.querySelectorAll("*")).some(hasReactFiber);
  }, { timeout });
}
