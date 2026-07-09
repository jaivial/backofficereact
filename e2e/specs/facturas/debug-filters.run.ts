/**
 * Debug script: inspect facturas filters layout at <640px viewport.
 *
 * Run: bun run e2e/specs/facturas/debug-filters.run.ts
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
  console.log("\nDebugging filters at <640px\n");

  const browser = await chromium.launch({ headless: true });

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setup: logging in...");
    await login(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector('.bo-invoiceFilters', { timeout: 10_000 });

    // Wait a moment for layout
    await page.waitForTimeout(800);

    // Inspect layout
    const info = await page.evaluate(() => {
      const out: any[] = [];

      const grid = document.querySelector('.bo-invoiceFiltersGrid');
      if (grid) {
        const style = window.getComputedStyle(grid);
        out.push({
          sel: '.bo-invoiceFiltersGrid',
          display: style.display,
          gridTemplateColumns: style.gridTemplateColumns,
          flexDirection: style.flexDirection,
          width: style.width,
        });
        // list children
        const children = Array.from(grid.children) as HTMLElement[];
        children.forEach((c, i) => {
          const s = window.getComputedStyle(c);
          out.push({
            sel: `.bo-invoiceFiltersGrid > child[${i}]`,
            tag: c.tagName,
            className: c.className,
            display: s.display,
            width: s.width,
            flexDirection: s.flexDirection,
            gridColumn: s.gridColumn,
          });
        });
      } else {
        out.push({ sel: '.bo-invoiceFiltersGrid', missing: true });
      }

      const foot = document.querySelector('.bo-invoiceFiltersFoot');
      if (foot) {
        const s = window.getComputedStyle(foot);
        out.push({
          sel: '.bo-invoiceFiltersFoot',
          display: s.display,
          flexDirection: s.flexDirection,
          width: s.width,
          alignItems: s.alignItems,
        });
        const footChildren = Array.from(foot.children) as HTMLElement[];
        footChildren.forEach((c, i) => {
          const s2 = window.getComputedStyle(c);
          out.push({
            sel: `.bo-invoiceFiltersFoot > child[${i}]`,
            tag: c.tagName,
            className: c.className,
            display: s2.display,
            flexDirection: s2.flexDirection,
            width: s2.width,
          });
        });
      }

      const actions = document.querySelector('.bo-invoiceFiltersActions');
      if (actions) {
        const s = window.getComputedStyle(actions);
        out.push({
          sel: '.bo-invoiceFiltersActions',
          display: s.display,
          flexDirection: s.flexDirection,
          width: s.width,
        });
        const actionChildren = Array.from(actions.children) as HTMLElement[];
        actionChildren.forEach((c, i) => {
          const s2 = window.getComputedStyle(c);
          out.push({
            sel: `.bo-invoiceFiltersActions > child[${i}]`,
            tag: c.tagName,
            className: c.className,
            display: s2.display,
            width: s2.width,
          });
        });
      }

      const search = document.querySelector('.bo-searchWithDropdown');
      if (search) {
        const s = window.getComputedStyle(search);
        out.push({
          sel: '.bo-searchWithDropdown',
          display: s.display,
          flexDirection: s.flexDirection,
          width: s.width,
        });
      }

      // Check viewport width
      out.push({ sel: 'viewport', width: window.innerWidth, height: window.innerHeight });

      return out;
    });

    console.log("\n--- Computed layout at 390px viewport ---");
    for (const r of info) {
      console.log(JSON.stringify(r));
    }
    console.log("--- end ---\n");

    await page.screenshot({ path: '/tmp/facturas-mobile.png', fullPage: true });
    console.log("  Screenshot saved to /tmp/facturas-mobile.png");

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });