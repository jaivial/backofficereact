/**
 * Fetch the actual served CSS at the URL the browser uses
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
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true, bypassCSP: true });
    const page: Page = await context.newPage();

    // Track network for CSS requests
    const cssRequests: { url: string; status: number }[] = [];
    page.on("response", async (resp) => {
      const url = resp.url();
      if (url.includes("invoice-filters") || url.includes("bo.css") || url.endsWith(".css")) {
        cssRequests.push({ url, status: resp.status() });
      }
    });

    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForSelector('.bo-invoiceFiltersGrid', { timeout: 10_000 });
    await page.waitForTimeout(800);

    console.log("CSS requests:");
    for (const r of cssRequests) console.log(`  ${r.status} ${r.url}`);

    // Now directly fetch the file via page.goto and check
    const cssContent = await page.evaluate(async () => {
      // Try fetching the bo.css aggregator with cache-bust
      const res = await fetch("/components/bo.css?direct&t=" + Date.now(), { cache: "no-store" });
      const text = await res.text();
      // Find invoiceFiltersGrid rules
      const matches: string[] = [];
      let idx = text.indexOf("bo-invoiceFiltersGrid");
      while (idx !== -1) {
        matches.push(text.substring(idx, idx + 250));
        const next = text.indexOf("bo-invoiceFiltersGrid", idx + 1);
        if (next === -1) break;
        idx = next;
      }
      return { url: res.url, matches: matches.slice(0, 5) };
    });
    console.log("\nFetched /components/bo.css?direct:");
    console.log("URL:", cssContent.url);
    console.log("First 3 matches:");
    for (const m of cssContent.matches.slice(0, 3)) {
      console.log(`  ${m.substring(0, 200)}`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });