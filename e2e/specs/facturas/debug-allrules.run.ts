/**
 * Print ALL CSS rules in the browser that have 'invoiceFiltersGrid'
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

    const result = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);

      const allRules: any[] = [];
      let totalSheets = 0;
      let totalRules = 0;

      for (const sheet of Array.from(document.styleSheets)) {
        totalSheets++;
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            totalRules++;
            const txt = (rule as any).cssText || "";
            if (txt.includes("invoiceFiltersGrid")) {
              const info: any = {
                href: sheet.href || "(inline)",
                type: rule.constructor.name,
                cssText: txt.substring(0, 500),
              };
              if (rule instanceof CSSMediaRule) {
                info.media = rule.conditionText;
                info.mediaActive = window.matchMedia(rule.conditionText).matches;
                info.innerRules = Array.from(rule.cssRules).map((r: any) => r.cssText).join("\n  ");
              }
              allRules.push(info);
            }
          }
        } catch (e) {
          // skip
        }
      }

      return {
        totalSheets,
        totalRules,
        allRules,
        computedColumns: cs.gridTemplateColumns,
        computedDisplay: cs.display,
      };
    });

    console.log(`Total sheets: ${result?.totalSheets}, total rules: ${result?.totalRules}`);
    console.log(`Computed grid-template-columns: ${result?.computedColumns}`);
    console.log(`Computed display: ${result?.computedDisplay}`);
    console.log(`\nAll rules containing 'invoiceFiltersGrid':`);
    for (const r of result?.allRules || []) {
      console.log(`  href=${r.href}`);
      console.log(`    type=${r.type} media=${r.media || "no"} active=${r.mediaActive ?? "n/a"}`);
      console.log(`    cssText=${r.cssText.substring(0, 300)}`);
      if (r.innerRules) console.log(`    inner: ${r.innerRules.substring(0, 300)}`);
      console.log("");
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });