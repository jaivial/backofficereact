/**
 * Check all grid-related styles
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
      if (!el) return null;
      const cs = window.getComputedStyle(el);

      // Get ALL grid-related properties
      const gridProps: any = {};
      const propNames = [
        'display', 'grid-template-columns', 'grid-template-rows', 'grid-template-areas',
        'grid-template', 'grid-auto-columns', 'grid-auto-rows', 'grid-auto-flow',
        'grid-column-gap', 'grid-row-gap', 'gap', 'column-gap', 'row-gap',
        'grid-column-start', 'grid-column-end', 'grid-row-start', 'grid-row-end',
        'width', 'min-width', 'max-width',
      ];
      for (const p of propNames) {
        gridProps[p] = cs.getPropertyValue(p);
      }

      // Get parent
      const parent = el.parentElement;
      let parentInfo: any = null;
      if (parent) {
        const pcs = window.getComputedStyle(parent);
        parentInfo = {
          className: parent.className,
          display: pcs.display,
          gridTemplateColumns: pcs.gridTemplateColumns,
          gridTemplateRows: pcs.gridTemplateRows,
        };
      }

      // Get inline style
      return {
        props: gridProps,
        inline: el.style.cssText,
        parent: parentInfo,
        childrenCount: el.children.length,
      };
    });

    console.log("Properties:");
    for (const [k, v] of Object.entries(result?.props || {})) {
      console.log(`  ${k}: ${v}`);
    }
    console.log("\nInline:", JSON.stringify(result?.inline));
    console.log("Children:", result?.childrenCount);
    console.log("Parent:", JSON.stringify(result?.parent, null, 2));

    // Now manually check via CDP what the actual cascade is
    const client = await page.context().newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");
    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: ".bo-invoiceFiltersGrid" });

    if (nodeIds.length > 0) {
      const { matchedCSSRules } = await client.send("CSS.getMatchedStylesForNode", { nodeId: nodeIds[0] });
      console.log("\nCDP matched rules (showing all):");
      for (const r of matchedCSSRules) {
        const m = r as any;
        const sel = m.rule.selectorList.text;
        const media = m.rule.media?.map((mm: any) => mm.text).join(",") || "no";
        const grid = m.rule.style.cssProperties.find((p: any) => p.name === "grid-template-columns");
        const display = m.rule.style.cssProperties.find((p: any) => p.name === "display");
        if (sel.includes("invoiceFiltersGrid") || grid || display) {
          console.log(`  origin=${m.rule.origin} media=${media} sel="${sel}"`);
          for (const p of m.rule.style.cssProperties) {
            console.log(`    ${p.name}: ${p.value}`);
          }
        }
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });