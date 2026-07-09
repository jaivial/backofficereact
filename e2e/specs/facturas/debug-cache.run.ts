/**
 * Hard reload and inspect
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

    // Hard reload to bust cache
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector('.bo-invoiceFiltersGrid', { timeout: 10_000 });
    await page.waitForTimeout(1500);

    // Check what gridTemplateColumns resolves to
    const result = await page.evaluate(() => {
      const grid = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!grid) return null;
      const cs = window.getComputedStyle(grid);

      // List ALL stylesheets with this selector and grid-template-columns
      const rules: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const collect = (rule: any, mediaText: string) => {
            const txt = rule.cssText || "";
            if (txt.includes(".bo-invoiceFiltersGrid") && txt.includes("grid-template-columns")) {
              const active = mediaText === "no-media" ? true : window.matchMedia(mediaText).matches;
              rules.push({ media: mediaText, active, css: txt, href: sheet.href || "(inline)" });
            }
          };
          for (const r of Array.from(sheet.cssRules)) {
            if (r instanceof CSSMediaRule) {
              for (const inner of Array.from(r.cssRules)) collect(inner, r.conditionText);
            } else {
              collect(r, "no-media");
            }
          }
        } catch {}
      }

      return {
        gridComputed: {
          gridTemplateColumns: cs.gridTemplateColumns,
          width: cs.width,
        },
        rules,
      };
    });

    console.log("Grid:", JSON.stringify(result?.gridComputed));
    console.log("\nAll rules touching .bo-invoiceFiltersGrid:");
    for (const r of result?.rules || []) {
      console.log(`  [${r.media}] active=${r.active} src=${r.href}`);
      console.log(`    ${r.css}`);
    }

    // Also check the children widths
    const childWidths = await page.evaluate(() => {
      const grid = document.querySelector('.bo-invoiceFiltersGrid');
      if (!grid) return [];
      return Array.from(grid.children).map((c: any) => ({
        className: c.className,
        offsetWidth: c.offsetWidth,
      }));
    });
    console.log("\nChildren widths:");
    for (const c of childWidths) {
      console.log(`  ${c.className.split(" ").filter((x: string) => x.startsWith("bo-invoiceFilter")).join(" ")}: ${c.offsetWidth}px`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });