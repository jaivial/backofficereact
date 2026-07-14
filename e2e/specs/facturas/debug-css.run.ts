/**
 * Debug: check what CSS is actually applied to .bo-invoiceFiltersGrid
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
    await page.waitForSelector('.bo-invoiceFilters', { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Use CDP to get matched CSS rules
    const client = await page.context().newCDPSession(page);
    await client.send("DOM.enable");
    await client.send("CSS.enable");

    const { root } = await client.send("DOM.getDocument", { depth: -1, pierce: true });
    const { nodeIds } = await client.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: ".bo-invoiceFiltersGrid" });

    if (nodeIds.length > 0) {
      const { matchedCSSRules } = await client.send("CSS.getMatchedStylesForNode", { nodeId: nodeIds[0] });
      console.log("\n--- Matched CSS rules for .bo-invoiceFiltersGrid ---");
      for (const r of matchedCSSRules ?? []) {
        const media = (r as any).rule.media?.map((m: any) => m.text).join(",") || "no-media";
        const sel = (r as any).rule.selectorList.text;
        console.log(`[media: ${media}] ${sel}`);
        for (const p of (r as any).rule.style.cssProperties) {
          if (!p.disabled && p.name.includes("grid") || p.name === "width" || p.name === "display") {
            console.log(`    ${p.name}: ${p.value}`);
          }
        }
      }
    }

    // Check loaded stylesheets
    const sheetInfo = await page.evaluate(() => {
      const result: any[] = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const href = sheet.href || "(inline)";
          if (href.includes("invoice-filters") || href.includes("facturas")) {
            result.push({ href, rulesCount: sheet.cssRules.length });
          }
        } catch {}
      }
      return result;
    });
    console.log("\n--- Stylesheets ---");
    console.log(JSON.stringify(sheetInfo, null, 2));

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
