/**
 * Inline test - set grid-template-columns to '1fr' with !important and check
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

    // Try multiple ways to override
    const results: any[] = [];

    // 1. Check initial
    const initial = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        inlineCssText: el.style.cssText,
      };
    });
    results.push({ test: "initial", ...initial });

    // 2. Set inline !important
    await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      el.setAttribute('style', 'grid-template-columns: 1fr !important');
    });
    await page.waitForTimeout(200);
    const afterInline = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        inlineCssText: el.style.cssText,
      };
    });
    results.push({ test: "inline !important", ...afterInline });

    // 3. Check the parent .bo-panel -- it might have display: grid on it that's affecting children
    const parent = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFilters') as HTMLElement;
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        display: cs.display,
        gridTemplateColumns: cs.gridTemplateColumns,
        gap: cs.gap,
        inlineCssText: el.style.cssText,
      };
    });
    results.push({ test: "parent .bo-invoiceFilters", ...parent });

    // 4. Check what styles are applied via getMatchedCSSRules
    const client = await page.context().newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: ".bo-invoiceFiltersGrid" });
    if (nodeIds.length > 0) {
      const { matchedCSSRules } = await client.send("CSS.getMatchedStylesForNode", { nodeId: nodeIds[0] });
      console.log("\nFinal matched rules (origin & selector):");
      for (const r of matchedCSSRules) {
        const m = r as any;
        const sel = m.rule.selectorList.text;
        const gridProp = m.rule.style.cssProperties.find((p: any) => p.name === "grid-template-columns");
        if (gridProp || sel.includes("invoiceFiltersGrid")) {
          console.log(`  origin=${m.rule.origin} sel="${sel}" media=${m.rule.media?.map((mm:any)=>mm.text).join(",") || "no"}`);
          if (gridProp) console.log(`    grid-template-columns: ${gridProp.value}`);
        }
      }
    }

    console.log("\nResults:");
    for (const r of results) console.log(JSON.stringify(r));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });