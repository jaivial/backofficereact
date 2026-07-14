import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3001";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD;

async function login(page: Page): Promise<void> {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error("Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD or load backend/.env");
  }

  await page.goto(`${BASE_URL}/m/login`, { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(
    async ({ email, password }) => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: email, password }),
      });
      return { ok: response.ok, data: await response.json() };
    },
    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  );

  expect(result.ok).toBe(true);
  expect(result.data.success).toBe(true);
}

async function viewportSnapshot(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".bo-mobile-shell, .bo-app--page");
    const root = document.documentElement;
    const body = document.body;
    const visibleHeight = window.visualViewport?.height ?? window.innerHeight;
    const shellRect = shell?.getBoundingClientRect();

    return {
      visibleHeight,
      shellBottom: shellRect?.bottom ?? 0,
      shellHeight: shellRect?.height ?? 0,
      documentHeight: Math.max(root.scrollHeight, body.scrollHeight),
      viewportHeight: window.innerHeight,
    };
  });
}

test.describe("Mobile keyboard viewport", () => {
  let context!: BrowserContext;

  test.beforeEach(async ({ browser }) => {
    context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
  });

  test.afterEach(async () => {
    await context.close();
  });

  test("restores mobile shells without blank space after keyboard cycle", async () => {
    const page = await context.newPage();
    await login(page);

    for (const route of ["/m/app/backoffice", "/app/dashboard"]) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });

      const before = await viewportSnapshot(page);
      await page.setViewportSize({ width: 390, height: 430 });
      await expect.poll(async () => (await viewportSnapshot(page)).visibleHeight).toBe(430);
      const keyboardVisible = await viewportSnapshot(page);

      await page.setViewportSize({ width: 390, height: 844 });
      await expect.poll(async () => (await viewportSnapshot(page)).visibleHeight).toBe(844);
      const after = await viewportSnapshot(page);

      expect(Math.abs(before.shellBottom - before.visibleHeight), route).toBeLessThanOrEqual(1);
      expect(Math.abs(keyboardVisible.shellBottom - keyboardVisible.visibleHeight), route).toBeLessThanOrEqual(1);
      expect(Math.abs(after.shellBottom - after.visibleHeight), route).toBeLessThanOrEqual(1);
      expect(after.documentHeight, route).toBeLessThanOrEqual(after.viewportHeight + 1);
    }
  });
});
