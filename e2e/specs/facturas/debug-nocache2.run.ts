/**
 * Reload with cache disabled
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

    // Clear cache and reload
    await page.evaluate(() => {
      // @ts-ignore
      if (window.caches) caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    });

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const computed = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
      };
    });
    console.log("After clear cache + reload:", computed);

    // Print all matched rules
    const rules = await page.evaluate(() => {
      const matchedRules: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule) {
              for (const inner of Array.from(rule.cssRules)) {
                const txt = (inner as any).cssText || "";
                if (txt.includes("bo-invoiceFiltersGrid") && txt.includes("grid-template-columns")) {
                  matchedRules.push({
                    media: rule.conditionText,
                    active: window.matchMedia(rule.conditionText).matches,
                    css: txt.substring(0, 200),
                  });
                }
              }
            }
          }
        } catch {}
      }
      return matchedRules;
    });
    console.log("\nMatched rules:");
    for (const r of rules) console.log(`  [${r.media}] active=${r.active}: ${r.css}`);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });