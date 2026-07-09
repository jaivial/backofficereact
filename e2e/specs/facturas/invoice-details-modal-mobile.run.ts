/**
 * Validate invoice details modal on mobile
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

interface Result {
  name: string;
  passed: boolean;
  error?: string;
}

function pass(name: string) { console.log(`  PASS  ${name}`); results.push({ name, passed: true }); }
function fail(name: string, msg: string) { console.log(`  FAIL  ${name}: ${msg}`); results.push({ name, passed: false, error: msg }); }

let results: Result[] = [];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

async function main(): Promise<void> {
  console.log("\nInvoice Details Modal — Mobile E2E\n");

  const browser = await chromium.launch({ headless: true });
  results = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector('[aria-label*="Acciones de factura"]', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // Open Ver detalles
    await page.locator('[aria-label*="Acciones de factura"]').first().click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]').filter({ hasText: "Ver detalles" }).click();
    await page.waitForTimeout(800);

    const modal = page.locator('[role="dialog"]').filter({ hasText: "Detalles de factura" });
    await modal.waitFor({ state: "visible", timeout: 5000 });

    // Test 1: Modal opens
    try {
      const visible = await modal.isVisible();
      if (!visible) throw new Error("Modal not visible");
      pass("Modal opens on Ver detalles");
    } catch (e: unknown) {
      fail("Modal opens", e instanceof Error ? e.message : String(e));
    }

    // Test 2: Modal fits within mobile viewport
    try {
      const dims = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
        const rect = dialog.getBoundingClientRect();
        return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, vw: window.innerWidth, vh: window.innerHeight };
      });
      // Modal should be near-full-width (within 24px of viewport)
      if (dims.x < 0) throw new Error(`Modal x=${dims.x} < 0`);
      if (dims.w < dims.vw - 30) throw new Error(`Modal width ${dims.w} too small for mobile (vw=${dims.vw})`);
      if (dims.w > dims.vw + 4) throw new Error(`Modal width ${dims.w} exceeds viewport ${dims.vw}`);
      pass(`Modal fits mobile viewport (${dims.w}x${dims.h})`);
    } catch (e: unknown) {
      fail("Modal fits viewport", e instanceof Error ? e.message : String(e));
    }

    // Test 3: Single-column layout on mobile
    try {
      const cols = await page.evaluate(() => {
        const grid = document.querySelector('.bo-invoiceDetailsColumns');
        if (!grid) return null;
        const cs = window.getComputedStyle(grid);
        return cs.gridTemplateColumns;
      });
      // Should be a single column (one value, not two)
      const trackCount = (cols?.match(/px|%|fr/g) || []).length;
      if (trackCount !== 1) throw new Error(`Expected 1 column on mobile, got ${trackCount} (template: ${cols})`);
      pass("Single-column layout on mobile");
    } catch (e: unknown) {
      fail("Single-column layout", e instanceof Error ? e.message : String(e));
    }

    // Test 4: Detail rows stack label above value on mobile
    try {
      const stacking = await page.evaluate(() => {
        const rows = document.querySelectorAll('.bo-detailRow');
        if (rows.length === 0) return null;
        const first = rows[0] as HTMLElement;
        const label = first.querySelector('.bo-detailRow__label') as HTMLElement;
        const value = first.querySelector('.bo-detailRow__value') as HTMLElement;
        const labelRect = label.getBoundingClientRect();
        const valueRect = value.getBoundingClientRect();
        return { labelTop: labelRect.top, valueTop: valueRect.top, valueLeft: valueRect.left, labelLeft: labelRect.left };
      });
      if (!stacking) throw new Error("No detail rows found");
      // Value should be below label (labelTop < valueTop)
      if (stacking.labelTop >= stacking.valueTop) throw new Error(`Label at ${stacking.labelTop}, value at ${stacking.valueTop} (not stacked)`);
      // And both should be indented from row edge (offset from left > 0)
      if (stacking.labelLeft <= 30 || stacking.valueLeft <= 30) throw new Error("Label/value not indented from row edge");
      pass("Detail rows stack label above value");
    } catch (e: unknown) {
      fail("Detail rows stack", e instanceof Error ? e.message : String(e));
    }

    // Test 5: Amount and status visible at top
    try {
      const header = await page.evaluate(() => {
        const amount = document.querySelector('.bo-invoiceDetailsAmount');
        const status = document.querySelector('.bo-invoiceDetailsStatus .bo-badge');
        return {
          amountVisible: !!amount && amount.getBoundingClientRect().height > 0,
          statusVisible: !!status && status.getBoundingClientRect().height > 0,
        };
      });
      if (!header.amountVisible) throw new Error("Amount not visible");
      if (!header.statusVisible) throw new Error("Status badge not visible");
      pass("Header shows amount + status");
    } catch (e: unknown) {
      fail("Header", e instanceof Error ? e.message : String(e));
    }

    // Test 6: Action buttons at bottom (Email button visible)
    try {
      const emailBtn = page.locator('[data-testid="details-send-email-btn"]');
      const visible = await emailBtn.isVisible();
      if (!visible) throw new Error("Email button not visible");
      pass("Action buttons present at bottom");
    } catch (e: unknown) {
      fail("Action buttons", e instanceof Error ? e.message : String(e));
    }

    // Test 7: Modal is scrollable when content overflows
    try {
      const scrollable = await page.evaluate(() => {
        const body = document.querySelector('.bo-invoiceDetailsBody') as HTMLElement;
        if (!body) return null;
        const cs = window.getComputedStyle(body);
        return {
          overflowY: cs.overflowY,
          scrollHeight: body.scrollHeight,
          clientHeight: body.clientHeight,
          scrollable: body.scrollHeight > body.clientHeight && (cs.overflowY === "auto" || cs.overflowY === "scroll"),
        };
      });
      // Even if content doesn't overflow, overflow-y should be auto
      if (scrollable && scrollable.overflowY !== "auto" && scrollable.overflowY !== "scroll") {
        throw new Error(`Body overflowY is ${scrollable?.overflowY}, expected auto/scroll`);
      }
      pass("Modal body is scrollable");
    } catch (e: unknown) {
      fail("Modal body scrollable", e instanceof Error ? e.message : String(e));
    }

    // Test 8: Close modal via X button
    try {
      await page.locator('[role="dialog"] button[aria-label="Cerrar"]').click();
      await page.waitForTimeout(500);
      const stillVisible = await modal.isVisible().catch(() => false);
      if (stillVisible) throw new Error("Modal still visible after close");
      pass("Modal closes via X button");
    } catch (e: unknown) {
      fail("Modal closes", e instanceof Error ? e.message : String(e));
    }

    // Test 9: Desktop view also works (regression check)
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.waitForTimeout(300);
      await page.locator('[aria-label*="Acciones de factura"]').first().click();
      await page.waitForTimeout(500);
      await page.locator('[role="menuitem"]').filter({ hasText: "Ver detalles" }).click();
      await page.waitForTimeout(800);

      const cols = await page.evaluate(() => {
        const grid = document.querySelector('.bo-invoiceDetailsColumns');
        if (!grid) return null;
        const cs = window.getComputedStyle(grid);
        return cs.gridTemplateColumns;
      });
      const trackCount = (cols?.match(/px|%|fr/g) || []).length;
      if (trackCount !== 2) throw new Error(`Expected 2 columns on desktop, got ${trackCount} (${cols})`);
      pass("Two-column layout preserved on desktop");
    } catch (e: unknown) {
      fail("Desktop two-column", e instanceof Error ? e.message : String(e));
    }

    // Final screenshot
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: '/tmp/invoice-details-final.png', fullPage: false });
    console.log("\n  Final screenshot: /tmp/invoice-details-final.png");

    await context.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });