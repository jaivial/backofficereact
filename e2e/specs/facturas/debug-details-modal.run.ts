/**
 * Inspect invoice details modal on mobile
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector('[aria-label*="Acciones de factura"]', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // Open first actions dropdown
    await page.locator('[aria-label*="Acciones de factura"]').first().click();
    await page.waitForTimeout(500);

    // Click Ver detalles
    await page.locator('[role="menuitem"]').filter({ hasText: "Ver detalles" }).click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[role="dialog"]').filter({ hasText: "Detalles de factura" });
    await modal.waitFor({ state: "visible", timeout: 5000 });

    // Inspect modal layout
    const info = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      const cs = window.getComputedStyle(dialog);

      const head = dialog.querySelector('.bo-modalHead');
      const body = dialog.querySelectorAll('div');
      const detailRows = dialog.querySelectorAll('.bo-detailRow');

      return {
        dialog: {
          offsetWidth: dialog.offsetWidth,
          offsetHeight: dialog.offsetHeight,
          width: cs.width,
          maxWidth: cs.maxWidth,
          maxHeight: cs.maxHeight,
          height: cs.height,
          padding: cs.padding,
          overflowY: cs.overflowY,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        headRect: head?.getBoundingClientRect(),
        detailRowCount: detailRows.length,
        firstDetailRow: detailRows[0]?.getBoundingClientRect(),
      };
    });

    console.log(JSON.stringify(info, null, 2));

    await page.screenshot({ path: '/tmp/invoice-details-mobile.png', fullPage: true });
    console.log("\nScreenshot saved");

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });