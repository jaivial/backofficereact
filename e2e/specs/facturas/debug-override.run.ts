/**
 * Try manipulating the element directly to see if any inline change works
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
    await page.waitForSelector('.bo-invoiceFiltersGrid', { timeout: 10_000 });
    await page.waitForTimeout(800);

    // Inject a test stylesheet that overrides with high specificity
    await page.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        .bo-invoiceFiltersGrid.bo-invoiceFiltersGrid {
          grid-template-columns: 1fr !important;
        }
      `;
      document.head.appendChild(style);
    });
    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        display: cs.display,
      };
    });
    console.log("After injecting high-specificity override:", result);

    // Test with inline !important
    await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      el.style.cssText = 'grid-template-columns: 1fr !important;';
    });
    await page.waitForTimeout(300);

    const result2 = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        inlineCssText: el.style.cssText,
      };
    });
    console.log("After inline !important:", result2);

    // Try with display block to see if that's the issue
    await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      el.style.cssText = 'display: block !important;';
    });
    await page.waitForTimeout(300);

    const result3 = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        display: cs.display,
        inlineCssText: el.style.cssText,
      };
    });
    console.log("After display block !important:", result3);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });