/**
 * Final debug: find what's setting grid-template-columns on .bo-invoiceFiltersGrid
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
    await page.waitForTimeout(1500);

    // Use CDP to get the actual cascade
    const client = await page.context().newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");

    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: ".bo-invoiceFiltersGrid" });

    if (nodeIds.length > 0) {
      const { matchedCSSRules, inlineStyle, attributesStyle, inherited } = await client.send("CSS.getMatchedStylesForNode", { nodeId: nodeIds[0] });

      console.log("=== ALL MATCHED CSS RULES ===");
      for (const r of matchedCSSRules ?? []) {
        const m = r as any;
        const media = (m.rule.media?.map((mm: any) => mm.text).join(",")) || "no-media";
        const origin = m.rule.origin;
        const sel = m.rule.selectorList.text;
        const grid = m.rule.style.cssProperties.find((p: any) => p.name === "grid-template-columns");
        console.log(`  origin=${origin} media=${media} sel="${sel}"`);
        if (grid) console.log(`    grid-template-columns: ${grid.value} (origin: ${grid.origin})`);
      }

      console.log("\n=== INLINE STYLE ===");
      console.log(JSON.stringify(inlineStyle, null, 2));

      console.log("\n=== ATTRIBUTES STYLE ===");
      console.log(JSON.stringify(attributesStyle, null, 2));

      // Check inherited for grid-template-columns
      if (inherited && inherited.length > 0) {
        for (const ih of inherited) {
          for (const m of ih.matchedCSSRules || []) {
            const mm = m as any;
            const sel = mm.rule.selectorList.text;
            const grid = mm.rule.style.cssProperties.find((p: any) => p.name === "grid-template-columns");
            if (grid) console.log(`  inherited sel="${sel}" grid-template-columns: ${grid.value}`);
          }
        }
      }
    }

    // Also check computed grid using getComputedStyle
    const computed = await page.evaluate(() => {
      const el = document.querySelector('.bo-invoiceFiltersGrid') as HTMLElement;
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      return {
        gridTemplateColumns: cs.gridTemplateColumns,
        inlineStyle: el.style.cssText,
        outerWidth: el.offsetWidth,
      };
    });
    console.log("\n=== COMPUTED ===");
    console.log(JSON.stringify(computed, null, 2));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
