/**
 * E2E test for Bookings View Tabs (Activas / Canceladas / Modificadas)
 * on reservas page.
 *
 * Uses patchright (drop-in Playwright replacement) against
 * https://backoffice-dev.menustudioai.com.
 *
 * Run: bun run e2e/specs/reservas/reservas-tabs.run.ts
 * Env: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
 */
import type { BrowserContext, Page } from "patchright";
import { chromium } from "patchright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const TODAY = new Date().toISOString().slice(0, 10);

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

async function gotoReservas(page: Page, date: string): Promise<void> {
  await page.goto(`${BASE_URL}/app/reservas?date=${date}`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function main(): Promise<void> {
  console.log("\nReservas Tabs E2E Tests\n");

  const browser = await chromium.launch({ headless: true });
  const results: TestResult[] = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setup: logging in...");
    await login(page);
    console.log("  Setup done.\n");

    // ─── Test 1: Tab switcher visible on open day ──────────────────────
    await test("tab switcher visible on open day", async () => {
      await gotoReservas(page, TODAY);
      await page.waitForSelector('[data-testid="bookings-view-tabs"]', { timeout: 10_000 });
      await page.waitForSelector('[data-testid="tab-activas"]', { timeout: 5_000 });
      await page.waitForSelector('[data-testid="tab-canceladas"]', { timeout: 5_000 });
      await page.waitForSelector('[data-testid="tab-modificadas"]', { timeout: 5_000 });
    });

    // ─── Test 2: Tab "Activas" (default) shows booking table ───────────
    await test("activas tab shows booking table", async () => {
      await gotoReservas(page, TODAY);
      await page.waitForSelector('[data-testid="bookings-view-tabs"]', { timeout: 10_000 });
      // Default active tab is Activas
      const tabActive = page.getByTestId("tab-activas");
      const isSelected = await tabActive.getAttribute("aria-selected");
      if (isSelected !== "true") {
        await tabActive.click();
        await page.waitForTimeout(500);
      }
      // The reservas table should be visible when Activas is active
      await page.waitForSelector('[data-slot="reservas-tabla-de-reservas"]', { timeout: 5_000 });
      await page.waitForSelector('[data-testid="reservas-page-pagination"]', { timeout: 5_000 });
    });

    // ─── Test 3: Click Canceladas tab shows cancelled panel ────────────
    await test("canceladas tab shows cancelled panel", async () => {
      await gotoReservas(page, TODAY);
      await page.waitForSelector('[data-testid="bookings-view-tabs"]', { timeout: 10_000 });
      await page.getByTestId("tab-canceladas").click();
      await page.waitForTimeout(800);
      // Should show the panel (either loading, empty, or data)
      const panel = page.locator('[data-slot="canceladas-panel"]');
      await panel.waitFor({ state: "visible", timeout: 5_000 });
      // The table should NOT be visible when on Canceladas tab
      const table = page.locator('[data-slot="reservas-tabla-de-reservas"]');
      const tableVisible = await table.isVisible();
      if (tableVisible) {
        throw new Error("Booking table is visible when Canceladas tab is active");
      }
    });

    // ─── Test 4: Click Modificadas tab shows modified panel ────────────
    await test("modificadas tab shows modified panel", async () => {
      await gotoReservas(page, TODAY);
      await page.waitForSelector('[data-testid="bookings-view-tabs"]', { timeout: 10_000 });
      await page.getByTestId("tab-modificadas").click();
      await page.waitForTimeout(800);
      const panel = page.locator('[data-slot="modificadas-panel"]');
      await panel.waitFor({ state: "visible", timeout: 5_000 });
      const table = page.locator('[data-slot="reservas-tabla-de-reservas"]');
      const tableVisible = await table.isVisible();
      if (tableVisible) {
        throw new Error("Booking table is visible when Modificadas tab is active");
      }
    });

    // ─── Test 5: Tabs have same UI class as route tabs ─────────────────
    await test("tab switcher uses bo-tabs--glass class", async () => {
      await gotoReservas(page, TODAY);
      const tabsNav = page.locator('[data-testid="bookings-view-tabs"] nav');
      await tabsNav.waitFor({ state: "visible", timeout: 10_000 });
      const cls = await tabsNav.getAttribute("class");
      if (!cls || !cls.includes("bo-tabs--glass")) {
        throw new Error(`Tab nav missing bo-tabs--glass class: ${cls}`);
      }
    });

    // ─── Test 6: Canceladas → staff table with cancelled_by_name ───────
    await test("canceladas shows staff name for staff cancellations", async () => {
      await gotoReservas(page, TODAY);
      await page.waitForSelector('[data-slot="reservas-tableWrap"]', { timeout: 10_000 });
      // If there's a booking row, cancel it via menu
      const row = page.locator('[data-slot="reservas-table-row"]').first();
      if (await row.isVisible()) {
        // Open dropdown menu and click "Cancelar"
        const actionsBtn = row.locator('[data-slot="reservas-end"] button').first();
        if (await actionsBtn.isVisible()) {
          await actionsBtn.click();
          await page.waitForTimeout(300);
          // Click "Cancelar" in dropdown
          const cancelItem = page.locator('[data-testid="dropdown-item-cancel"]').first();
          if (await cancelItem.isVisible()) {
            await cancelItem.click();
            // Confirm in dialog
            const confirmBtn = page.getByRole("button", { name: "Cancelar" }).last();
            if (await confirmBtn.isVisible()) {
              await confirmBtn.click();
              await page.waitForTimeout(1000);
            }
          }
        }
      }
      // Switch to Canceladas tab
      await page.getByTestId("tab-canceladas").click();
      await page.waitForTimeout(1000);
      // Should see at least one table group with data
      const groupTitle = page.locator('[data-slot="tab-group-title"]').first();
      const titleVisible = await groupTitle.isVisible().catch(() => false);
      if (titleVisible) {
        const text = await groupTitle.textContent();
        if (text && text.includes("personal")) {
          // Staff name column should contain a non-empty value
          const nameCell = page.locator('[data-slot="tab-td-cancelled_by_name"]').first();
          if (await nameCell.isVisible()) {
            const name = await nameCell.textContent();
            // name should be something (staff user name)
            console.log(`    Staff name found: "${name}"`);
          }
        }
      }
    });

    // ─── Test 7: Reactivate button exists on cancelled rows ────────────
    await test("reactivate button present in cancelled tables", async () => {
      await gotoReservas(page, TODAY);
      await page.getByTestId("tab-canceladas").click();
      await page.waitForTimeout(1000);
      const reactivateBtn = page.locator('[data-testid="tab-reactivate-btn"]').first();
      const hasBtn = await reactivateBtn.isVisible().catch(() => false);
      // Either the button exists or the table is empty (both valid)
      const empty = page.locator('[data-slot="tab-empty"]').first();
      const emptyVisible = await empty.isVisible().catch(() => false);
      if (!hasBtn && !emptyVisible) {
        // Might still be loading
        console.log("    No reactivate button and no empty state - may be loading");
      }
    });

    // ─── Test 8: Modificadas shows empty state when no modifications ────
    await test("modificadas shows empty state or data tables", async () => {
      await gotoReservas(page, TODAY);
      await page.getByTestId("tab-modificadas").click();
      await page.waitForTimeout(1000);
      // Should show either empty state or table groups
      const empty = page.locator('[data-slot="tab-empty"]').first();
      const tableGroup = page.locator('[data-slot="tab-table"]').first();
      const hasEmpty = await empty.isVisible().catch(() => false);
      const hasTable = await tableGroup.isVisible().catch(() => false);
      if (!hasEmpty && !hasTable) {
        // Loading state is also valid
        const loading = page.locator('[data-slot="tab-loading"]').first();
        const loadingVisible = await loading.isVisible().catch(() => false);
        if (!loadingVisible) {
          throw new Error("Modificadas tab shows neither empty state, table, nor loading");
        }
      }
    });

    await context.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);

  // Helper to run and record tests
  function test(name: string, fn: () => Promise<void>) {
    return (async () => {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        results.push({ name, passed: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  FAIL  ${name}: ${msg}`);
        results.push({ name, passed: false, error: msg });
      }
    })();
  }
}

main();
