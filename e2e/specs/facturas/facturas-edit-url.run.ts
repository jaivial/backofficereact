/**
 * E2E: Facturas edit flow with URL query param.
 *
 * Run: bun run e2e/specs/facturas/facturas-edit-url.run.ts
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

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function main(): Promise<void> {
  console.log("\nFacturas Edit URL E2E Tests\n");

  const browser = await chromium.launch({ headless: true });
  const results: TestResult[] = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setting up: logging in...");
    await login(page);
    console.log("  Setup done.\n");

    // Test 1: Edit updates URL with invoice id
    try {
      await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForSelector('[aria-label*="Acciones de factura"]', { timeout: 10_000 });

      // Open actions dropdown and click Editar
      await page.locator('[aria-label*="Acciones de factura"]').first().click();
      await page.waitForTimeout(500);
      await page.locator('[role="menuitem"]').filter({ hasText: "Editar" }).click();
      await page.waitForTimeout(1000);

      const url = page.url();
      if (!url.includes("tab=a") || !url.includes("id=")) {
        throw new Error(`URL missing params: ${url}`);
      }
      console.log("  PASS  edit updates URL with invoice id");
      results.push({ name: "Edit URL update", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  edit updates URL: ${msg}`);
      results.push({ name: "Edit URL update", passed: false, error: msg });
    }

    // Test 2: Form pre-fills with invoice data
    try {
      await page.waitForTimeout(500);
      const hasValue = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const el of inputs) {
          if ((el as HTMLInputElement).value) return true;
        }
        return false;
      });
      if (!hasValue) throw new Error("No pre-filled inputs found");
      console.log("  PASS  form pre-fills with invoice data");
      results.push({ name: "Form pre-fill", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  form pre-fill: ${msg}`);
      results.push({ name: "Form pre-fill", passed: false, error: msg });
    }

    // Test 3: Edit URL survives page refresh
    try {
      const editUrl = page.url();
      await page.goto(editUrl, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(500);
      const hasValueAfterRefresh = await page.evaluate(() => {
        const inputs = document.querySelectorAll('input[type="text"], input:not([type])');
        for (const el of inputs) {
          if ((el as HTMLInputElement).value) return true;
        }
        return false;
      });
      if (!hasValueAfterRefresh) throw new Error("Form not pre-filled after refresh");
      console.log("  PASS  edit URL survives refresh");
      results.push({ name: "Survives refresh", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  survives refresh: ${msg}`);
      results.push({ name: "Survives refresh", passed: false, error: msg });
    }

    // Test 4: Cancel returns to resumen tab
    try {
      const cancelBtn = page.locator('button').filter({ hasText: "Cancelar" });
      await cancelBtn.click();
      await page.waitForTimeout(1000);

      const url = page.url();
      if (!url.includes("tab=resumen")) {
        throw new Error(`URL missing resumen: ${url}`);
      }
      if (url.includes("id=")) {
        throw new Error(`URL still has id: ${url}`);
      }
      console.log("  PASS  cancel returns to resumen tab");
      results.push({ name: "Cancel resets URL", passed: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL  cancel returns to resumen: ${msg}`);
      results.push({ name: "Cancel resets URL", passed: false, error: msg });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
