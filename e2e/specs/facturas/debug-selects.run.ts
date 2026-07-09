/**
 * Inspect select buttons in filters
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
    await page.waitForSelector('.bo-invoiceFilters', { timeout: 10_000 });
    await page.waitForTimeout(800);

    const result = await page.evaluate(() => {
      const selects = document.querySelectorAll('.bo-invoiceFiltersGrid .bo-selectBtn');
      return Array.from(selects).map((s: any) => {
        const cs = window.getComputedStyle(s);
        return {
          text: s.textContent?.trim().substring(0, 40),
          offsetWidth: s.offsetWidth,
          display: cs.display,
          width: cs.width,
          textAlign: cs.textAlign,
          justifyContent: cs.justifyContent,
        };
      });
    });

    console.log("Select buttons in filters grid:");
    for (const r of result) console.log(JSON.stringify(r));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });