/**
 * Debug: detailed inspection of grid-template-columns for filters
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

    // Check viewport + matches
    const evalResult = await page.evaluate(() => {
      const grid = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!grid) return null;
      const cs = window.getComputedStyle(grid);

      // Find any stylesheet rule with "bo-invoiceFiltersGrid"
      const matchedRules: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule) {
              for (const inner of Array.from(rule.cssRules)) {
                const txt = (inner as any).cssText || "";
                if (txt.includes("bo-invoiceFiltersGrid") && txt.includes("grid-template-columns")) {
                  matchedRules.push({
                    mediaActive: window.matchMedia(rule.conditionText).matches,
                    mediaText: rule.conditionText,
                    cssText: txt,
                    href: sheet.href || "(inline)",
                  });
                }
              }
            } else {
              const txt = (rule as any).cssText || "";
              if (txt.includes("bo-invoiceFiltersGrid") && txt.includes("grid-template-columns")) {
                matchedRules.push({
                  mediaText: "no-media",
                  cssText: txt,
                  href: sheet.href || "(inline)",
                });
              }
            }
          }
        } catch (e) {
          // skip cross-origin
        }
      }

      return {
        gridComputed: {
          gridTemplateColumns: cs.gridTemplateColumns,
          display: cs.display,
          width: cs.width,
        },
        matches: matchedRules,
      };
    });

    console.log("Grid computed:", JSON.stringify(evalResult?.gridComputed, null, 2));
    console.log("\nMatched rules for bo-invoiceFiltersGrid:");
    for (const m of evalResult?.matches || []) {
      console.log(`  [media: ${m.mediaText}] active=${m.mediaActive} src=${m.href}`);
      console.log(`    ${m.cssText}`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });