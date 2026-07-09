/**
 * Force browser to fetch fresh CSS by appending cache-bust query
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

    // Fetch the actual CSS file being loaded
    const cssHrefs = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
      return links.map((l: any) => l.href);
    });
    console.log("CSS links:");
    for (const h of cssHrefs) console.log("  ", h);

    // Check media query match
    const mediaMatch = await page.evaluate(() => ({
      maxWidth639: window.matchMedia('(max-width: 639px)').matches,
      innerWidth: window.innerWidth,
    }));
    console.log("\nMedia match:", mediaMatch);

    // Now get the ACTUAL computed style
    const computed = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      // Try to read each rule from stylesheets to see ACTUAL CSS text
      const rules: string[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const search = (rule: any) => {
            const txt = rule.cssText || "";
            if (txt.includes("bo-invoiceFiltersGrid") && txt.includes("grid-template-columns")) {
              rules.push(txt);
            }
          };
          for (const r of Array.from(sheet.cssRules)) {
            if (r instanceof CSSMediaRule) {
              for (const inner of Array.from(r.cssRules)) search(inner);
            } else {
              search(r);
            }
          }
        } catch {}
      }
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        rules,
      };
    });
    console.log("\nComputed:", JSON.stringify(computed, null, 2));

    // Try setting a different class or test override
    const override = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!el) return null;
      el.style.gridTemplateColumns = '1fr';
      const cs = window.getComputedStyle(el);
      return cs.gridTemplateColumns;
    });
    console.log("\nAfter inline override '1fr':", override);

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });