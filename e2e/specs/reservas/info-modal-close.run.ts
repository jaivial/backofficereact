/**
 * Standalone E2E test for InfoModal close bug on reservas config page.
 *
 * Bug: Modal close handlers (Cerrar, backdrop, Escape) called
 * setShowMandatoryInfo(true) instead of false — modal never closed.
 * Fix: separate onInfoClose = () => setShowMandatoryInfo(false).
 *
 * Run: bun run e2e/specs/reservas/info-modal-close.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

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

async function openConfigWithMenus(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
  await toggle.click();
  const infoBtn = page.getByRole("button", { name: "Más información" });
  await infoBtn.waitFor({ state: "visible", timeout: 10_000 });
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function main(): Promise<void> {
  console.log("\nInfoModal Close E2E Tests\n");

  const browser = await chromium.launch({ headless: true });
  const results: TestResult[] = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setting up: logging in...");
    await login(page);
    console.log("  Setup done.\n");

    // Test 1: Cerrar button closes modal
    try {
      await openConfigWithMenus(page);
      await page.getByRole("button", { name: "Más información" }).click();
      const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
      await dialog.waitFor({ state: "visible", timeout: 5_000 });
      await dialog.getByRole("button", { name: "Cerrar" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 5_000 });
      console.log("  PASS  closes via Cerrar button");
      results.push({ name: "Cerrar button", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  closes via Cerrar button: ${msg}`);
      results.push({ name: "Cerrar button", passed: false, error: msg });
    }

    // Test 2: Backdrop click closes modal
    try {
      await openConfigWithMenus(page);
      await page.getByRole("button", { name: "Más información" }).click();
      const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
      await dialog.waitFor({ state: "visible", timeout: 5_000 });
      // Modal overlay uses data-ui="modal-overlay" with onMouseDown close
      await page.locator('[data-ui="modal-overlay"]').click({ position: { x: 10, y: 10 } });
      await dialog.waitFor({ state: "hidden", timeout: 5_000 });
      console.log("  PASS  closes via backdrop click");
      results.push({ name: "Backdrop click", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  closes via backdrop click: ${msg}`);
      results.push({ name: "Backdrop click", passed: false, error: msg });
    }

    // Test 3: Escape key closes modal
    try {
      await openConfigWithMenus(page);
      await page.getByRole("button", { name: "Más información" }).click();
      const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
      await dialog.waitFor({ state: "visible", timeout: 5_000 });
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 5_000 });
      console.log("  PASS  closes via Escape key");
      results.push({ name: "Escape key", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  closes via Escape key: ${msg}`);
      results.push({ name: "Escape key", passed: false, error: msg });
    }

    // Test 4: Open → close → reopen cycle (3 times)
    try {
      await openConfigWithMenus(page);
      const infoBtn = page.getByRole("button", { name: "Más información" });
      for (let i = 0; i < 3; i++) {
        await infoBtn.click();
        const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
        await dialog.waitFor({ state: "visible", timeout: 5_000 });
        await dialog.getByRole("button", { name: "Cerrar" }).click();
        await dialog.waitFor({ state: "hidden", timeout: 5_000 });
      }
      console.log("  PASS  reopens after close (3 cycles)");
      results.push({ name: "Reopen cycle", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  reopens after close: ${msg}`);
      results.push({ name: "Reopen cycle", passed: false, error: msg });
    }

    // Test 5: Mobile viewport — Cerrar button works on touch
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await openConfigWithMenus(page);
      await page.getByRole("button", { name: "Más información" }).click();
      const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
      await dialog.waitFor({ state: "visible", timeout: 5_000 });
      await dialog.getByRole("button", { name: "Cerrar" }).click();
      await dialog.waitFor({ state: "hidden", timeout: 5_000 });
      console.log("  PASS  closes on mobile viewport (390x844)");
      results.push({ name: "Mobile viewport", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  closes on mobile viewport: ${msg}`);
      results.push({ name: "Mobile viewport", passed: false, error: msg });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
