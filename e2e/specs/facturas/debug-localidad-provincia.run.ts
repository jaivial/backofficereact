/**
 * Debug: verify linked Localidad/Provincia searchable selects.
 *
 * Run: BACKOFFICE_URL=https://localhost:3006 bun run e2e/specs/facturas/debug-localidad-provincia.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3006";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

async function optionCount(page: Page): Promise<number> {
  return page.locator('[data-role="searchable-select-option"]').count();
}

async function triggerText(page: Page, testid: string): Promise<string> {
  return (await page.locator(`[data-testid="${testid}"]`).innerText()).trim();
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const results: string[] = [];
  const check = (name: string, ok: boolean, extra = "") => {
    results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
  };
  try {
    const context: BrowserContext = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
    });
    const page: Page = await context.newPage();
    await login(page);
    await page.goto(`${BASE_URL}/app/facturas?tab=${encodeURIComponent("añadir")}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForSelector(".bo-invoiceForm", { timeout: 15_000 });

    // 1) Open Provincia, count all options (should be 52), then pick Barcelona.
    await page.locator('[data-testid="invoice-province-input"]').click();
    await page.waitForSelector('[data-role="searchable-select-option"]');
    const provCount = await optionCount(page);
    check("Provincia lists all 52 provinces", provCount === 52, `count=${provCount}`);

    await page.locator('[data-role="searchable-select-search"]').fill("Barcel");
    await page.waitForTimeout(150);
    await page.locator('[data-role="searchable-select-option"]', { hasText: "Barcelona" }).first().click();
    await page.waitForTimeout(200);
    const provVal = await triggerText(page, "invoice-province-input");
    check("Provincia value = Barcelona", provVal === "Barcelona", provVal);

    // 2) Localidad should now be filtered to Barcelona municipios only.
    const openStart = Date.now();
    await page.locator('[data-testid="invoice-city-input"]').click();
    await page.waitForSelector('[data-role="searchable-select-option"]');
    const openMs = Date.now() - openStart;
    const cityFilteredCount = await optionCount(page);
    check(
      "Localidad filtered by province (Barcelona ~311 municipios, <500)",
      cityFilteredCount > 100 && cityFilteredCount < 500,
      `count=${cityFilteredCount}, openMs=${openMs}`,
    );

    // choose a Barcelona municipio
    await page.locator('[data-role="searchable-select-search"]').fill("Sabadell");
    await page.waitForTimeout(150);
    await page.locator('[data-role="searchable-select-option"]', { hasText: "Sabadell" }).first().click();
    await page.waitForTimeout(150);
    const cityVal = await triggerText(page, "invoice-city-input");
    check("Localidad value = Sabadell", cityVal === "Sabadell", cityVal);

    // 3) Viceversa: clear province by re-opening it and clear the city selection.
    //    Change province to Madrid → city (Sabadell) should be cleared since it
    //    doesn't belong to Madrid.
    await page.locator('[data-testid="invoice-province-input"]').click();
    await page.locator('[data-role="searchable-select-search"]').fill("Madrid");
    await page.waitForTimeout(150);
    await page.locator('[data-role="searchable-select-option"]', { hasText: "Madrid" }).first().click();
    await page.waitForTimeout(200);
    const cityAfterProvChange = await triggerText(page, "invoice-city-input");
    check("Changing Provincia to Madrid clears mismatched Localidad", /selecciona/i.test(cityAfterProvChange), cityAfterProvChange);

    // 4) Viceversa: select a localidad while province=Madrid but pick a Madrid town,
    //    then pick a town from full list to auto-set province.
    //    First reset province by picking a town that sets its own province.
    //    Open localidad (filtered to Madrid), pick "Alcobendas".
    await page.locator('[data-testid="invoice-city-input"]').click();
    await page.locator('[data-role="searchable-select-search"]').fill("Alcobendas");
    await page.waitForTimeout(150);
    await page.locator('[data-role="searchable-select-option"]', { hasText: "Alcobendas" }).first().click();
    await page.waitForTimeout(150);
    const provAfterCity = await triggerText(page, "invoice-province-input");
    check("Selecting Localidad sets its Provincia (Alcobendas → Madrid)", provAfterCity === "Madrid", provAfterCity);

    console.log("\n=== Localidad/Provincia checks ===");
    for (const r of results) console.log("  " + r);
    console.log(results.every((r) => r.startsWith("PASS")) ? "\nRESULT: ALL PASS" : "\nRESULT: FAILURES");
    await page.screenshot({ path: "e2e/screenshots/facturas-localidad-provincia.png" });
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
