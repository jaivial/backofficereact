/**
 * Verify served CSS has the fix
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

    // Check actual rules loaded in the browser
    const rules = await page.evaluate(() => {
      const matchedRules: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule) {
              for (const inner of Array.from(rule.cssRules)) {
                const txt = (inner as any).cssText || "";
                if (txt.includes("datePresets") || txt.includes("invoiceFiltersGrid")) {
                  matchedRules.push({
                    media: rule.conditionText,
                    active: window.matchMedia(rule.conditionText).matches,
                    cssText: txt,
                  });
                }
              }
            }
          }
        } catch {}
      }
      return matchedRules;
    });

    console.log("Rules in browser:");
    for (const r of rules) {
      console.log(`  [${r.media}] active=${r.active}`);
      console.log(`    ${r.cssText}`);
    }

    // Check each child's grid-column
    const placements = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      return Array.from(el.children).map((c: any, i) => ({
        idx: i,
        className: c.className,
        gridColumnStart: window.getComputedStyle(c).gridColumnStart,
        gridColumnEnd: window.getComputedStyle(c).gridColumnEnd,
        width: c.offsetWidth,
      }));
    });
    console.log("\nChildren placements:");
    for (const p of placements) console.log(JSON.stringify(p));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });