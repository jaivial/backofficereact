/**
 * Quick debug test to capture exact console errors
 * when navigating FROM wine detail page ➜ reservas.
 */
import { test as base, expect, type ConsoleMessage, type Response } from "@playwright/test";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3010";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

const test = base.extend<{ page: any }>({
  page: async ({ browser }, use) => {
    const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    // Login
    await p.goto(BASE_URL, { waitUntil: "load", timeout: 30_000 });
    await p.evaluate(
      async ({ url, email, password }: any) => {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, password }), credentials: "include" });
        return r.json();
      },
      { url: `${BASE_URL}/api/admin/login`, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
    );
    await p.waitForTimeout(500);
    await use(p);
    await ctx.close();
  },
});

test("capture wine page errors then navigate", async ({ page }) => {
  // 1. Collect ALL console messages
  const consoleLogs: string[] = [];
  page.on("console", (msg: ConsoleMessage) => {
    const text = msg.text();
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleLogs.push(`[${type}] ${text}`);
    }
  });

  // 2. Track network responses
  const responses: any[] = [];
  page.on("response", async (res: Response) => {
    if (res.status() >= 400 || res.url().includes(".pageContext")) {
      const body = await res.text().catch(() => "(no body)");
      responses.push({
        url: res.url(),
        status: res.status(),
        ok: res.ok(),
        contentType: res.headers()["content-type"] || "",
        bodyPreview: body.slice(0, 300),
      });
    }
  });

  // 3. Go to wine detail
  console.log("=== 1. LOADING WINE DETAIL PAGE ===");
  await page.goto("/app/comida/vinos/39", { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(2000);
  console.log(`URL: ${page.url()}`);

  console.log("\n=== CONSOLE ERRORS ON WINE PAGE ===");
  for (const log of consoleLogs) console.log(log);
  consoleLogs.length = 0; // clear

  // 4. Check if error page already shown
  const errorPage = page.locator('[data-testid="error-page-primary-button"]');
  const isErrorOnWine = await errorPage.isVisible().catch(() => false);
  if (isErrorOnWine) {
    console.log("\n⚠️ WINE DETAIL PAGE ITSELF SHOWS ERROR PAGE!");
    const code = await page.locator('[data-ui="error-status"]').textContent().catch(() => "?");
    console.log(`   Status: ${code}`);
  } else {
    // Check if the wine detail editor is visible
    const editor = page.locator('[data-role="wine-detail-editor"]');
    console.log(`Wine detail editor visible: ${await editor.isVisible().catch(() => false)}`);

    // Check for specific wine elements
    const name = page.locator('[data-role="wine-detail-name-input"]');
    console.log(`Name field visible: ${await name.isVisible().catch(() => false)}`);
    const nameVal = await name.inputValue().catch(() => "(empty)");
    console.log(`Wine name: "${nameVal}"`);
  }

  // 5. Print network responses for wine page
  const wineResponses = responses.filter(r => r.url.includes(".pageContext") || r.status >= 400);
  if (wineResponses.length) {
    console.log("\n=== RESPONSES (wine page load) ===");
    for (const r of wineResponses) console.log(`  ${r.status} ${r.ok ? "OK" : "FAIL"} ${r.url}`);
  }

  // 6. Navigate to reservas
  console.log("\n=== 2. NAVIGATING TO RESERVAS ===");
  const mobileNav = page.locator('[data-testid="sidebar-nav-mobile"]');

  if (await mobileNav.isVisible().catch(() => false)) {
    const link = mobileNav.locator('a[href="/app/reservas"]');
    if ((await link.count()) > 0) {
      console.log("Clicking Reservas link in mobile nav...");
      await link.first().click();
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(3000);
    } else {
      console.log("Reservas link not found in mobile nav");
    }
  } else {
    console.log("Mobile nav not visible!");
  }

  console.log(`Final URL: ${page.url()}`);

  // 7. Print consolidated errors
  console.log("\n=== CONSOLE ERRORS AFTER NAVIGATION ===");
  for (const log of consoleLogs) console.log(log);

  // 8. Print relevant responses
  const navResponses = responses.filter(r => r.url.includes(".pageContext") || r.status >= 400);
  if (navResponses.length) {
    console.log("\n=== RESPONSES (after navigation) ===");
    for (const r of navResponses) {
      console.log(`  ${r.status} ${r.ok ? "OK" : "FAIL"} ${r.url}`);
      if (r.status >= 400 || r.url.includes(".pageContext")) {
        console.log(`  Content-Type: ${r.contentType}`);
        console.log(`  Body: ${r.bodyPreview}`);
      }
    }
  }

  // 9. Check if error page shown
  const isError = await errorPage.isVisible().catch(() => false);
  if (isError) {
    const code = await page.locator('[data-ui="error-status"]').textContent().catch(() => "?");
    const title = await page.locator('[data-ui="error-title"]').textContent().catch(() => "?");
    const msg = await page.locator('[data-ui="error-message"]').textContent().catch(() => "?");
    console.log(`\n⚠️ ERROR PAGE: ${code} — ${title} — ${msg}`);
  } else {
    console.log("\n✓ No error page shown");
  }

  await page.screenshot({ path: `test-results/artifacts/debug2-${Date.now()}.png` });
});
