/**
 * Check implicit grid behavior
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
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForSelector('.bo-invoiceFiltersGrid', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // First clear all grid styles
    await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      el.style.cssText = 'display: block !important;';
    });
    await page.waitForTimeout(150);

    const result = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      // Reset to display grid and see what columns become
      el.style.cssText = 'display: grid !important; grid-template-columns: 200px !important;';

      return {
        beforeDisplay: cs.display,
        afterDisplay: window.getComputedStyle(el).display,
        afterColumns: window.getComputedStyle(el).gridTemplateColumns,
        elWidth: el.offsetWidth,
        children: el.children.length,
        // Get each child's grid placement
        placements: Array.from(el.children).map((c: any, i) => ({
          idx: i,
          className: c.className,
          gridColumnStart: window.getComputedStyle(c).gridColumnStart,
          gridColumnEnd: window.getComputedStyle(c).gridColumnEnd,
          offsetWidth: c.offsetWidth,
        })),
      };
    });

    await page.waitForTimeout(150);
    const finalCols = await page.evaluate(() => window.getComputedStyle(document.querySelector('.bo-invoiceFiltersGrid')).gridTemplateColumns);
    console.log("Initial computed (display: block):");
    console.log(JSON.stringify(result, null, 2));
    console.log("\nFinal columns after setting 200px:", finalCols);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });