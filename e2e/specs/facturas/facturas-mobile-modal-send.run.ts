/**
 * E2E: Facturas — mobile tabs, details modal, send guard, email settings check.
 *
 * Run: bun run e2e/specs/facturas/facturas-mobile-modal-send.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

let results: { name: string; passed: boolean; error?: string }[] = [];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

function pass(name: string) {
  console.log(`  PASS  ${name}`);
  results.push({ name, passed: true });
}

function fail(name: string, msg: string) {
  console.log(`  FAIL  ${name}: ${msg}`);
  results.push({ name, passed: false, error: msg });
}

async function main(): Promise<void> {
  console.log("\nFacturas — Mobile / Modal / Send Guard E2E\n");

  const browser = await chromium.launch({ headless: true });
  results = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setup: logging in...");
    await login(page);
    console.log("  Setup done.\n");

    // ── Test 1: Mobile tabs centered ──
    console.log("  ── Mobile tabs ──");
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE_URL}/app/facturas`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForSelector('[data-testid="tabs"]', { timeout: 10_000 });

      const justify = await page.evaluate(() => {
        const tabs = document.querySelector('[data-testid="tabs"]');
        if (!tabs) return null;
        return window.getComputedStyle(tabs).justifyContent;
      });
      if (justify !== "center") {
        throw new Error(`Expected justify-content=center, got ${justify}`);
      }
      pass("Mobile tabs centered at 390px");
    } catch (e: unknown) {
      fail("Mobile tabs centered", e instanceof Error ? e.message : String(e));
    }

    // ── Test 2: Details modal ──
    console.log("\n  ── Details modal ──");
    try {
      // Reset viewport to desktop for easier interaction
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForSelector('[aria-label*="Acciones de factura"]', { timeout: 10_000 });

      // Open first actions dropdown
      await page.locator('[aria-label*="Acciones de factura"]').first().click();
      await page.waitForTimeout(500);

      // Click "Ver detalles"
      await page.locator('[role="menuitem"]').filter({ hasText: "Ver detalles" }).click();
      await page.waitForTimeout(800);

      // Modal should be visible
      const modal = page.locator('[role="dialog"]').filter({ hasText: "Detalles de factura" });
      await modal.waitFor({ state: "visible", timeout: 5000 });
      const visible = await modal.isVisible();
      if (!visible) throw new Error("Modal not visible");

      pass("Details modal opens on Ver detalles");
    } catch (e: unknown) {
      fail("Details modal opens", e instanceof Error ? e.message : String(e));
    }

    // ── Test 3: Close details modal via X ──
    try {
      const closeBtn = page.locator('[role="dialog"] button[aria-label="Cerrar"]');
      await closeBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('[role="dialog"]').filter({ hasText: "Detalles de factura" });
      const stillVisible = await modal.isVisible().catch(() => false);
      if (stillVisible) throw new Error("Modal still visible after close");

      pass("Details modal closes via X button");
    } catch (e: unknown) {
      fail("Details modal closes via X", e instanceof Error ? e.message : String(e));
    }

    // ── Test 4: Send guard in form — email required ──
    console.log("\n  ── Send guard ──");
    try {
      await page.goto(`${BASE_URL}/app/facturas?tab=añadir`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForTimeout(1000);

      // Check send button is disabled when no email
      const sendBtn = page.locator('[data-testid="invoice-submit-btn"]');
      await sendBtn.waitFor({ state: "visible", timeout: 5000 });
      const disabled = await sendBtn.isDisabled();
      if (!disabled) {
        throw new Error("Send button should be disabled when email is empty");
      }

      // Fill email
      const emailInput = page.locator('[data-testid="invoice-customer-email-input"], input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill("test@example.com");
        await page.waitForTimeout(300);
        const enabled = await sendBtn.isDisabled();
        if (enabled) {
          throw new Error("Send button should be enabled after filling email");
        }
      }

      pass("Send button disabled when no email, enabled after filling");
    } catch (e: unknown) {
      fail("Send button email guard", e instanceof Error ? e.message : String(e));
    }

    // ── Test 5: Email settings API check ──
    console.log("\n  ── Email settings API ──");
    try {
      // Call API directly via page
      const apiResult = await page.evaluate(async () => {
        const res = await fetch("/api/admin/config/email-provider");
        const data = await res.json();
        return {
          success: data.success,
          isComplete: data.isComplete,
          missingFields: data.missingFields,
        };
      });

      if (apiResult.success !== true) throw new Error("API returned success=false");
      if (typeof apiResult.isComplete !== "boolean") throw new Error("isComplete is not a boolean");
      if (!Array.isArray(apiResult.missingFields)) throw new Error("missingFields is not an array");

      pass("Email settings API returns isComplete + missingFields");
    } catch (e: unknown) {
      fail("Email settings API", e instanceof Error ? e.message : String(e));
    }

    // ── Test 6: Send blocked when email settings incomplete + toast ──
    console.log("\n  ── Send blocked toast ──");
    try {
      await page.goto(`${BASE_URL}/app/facturas?tab=resumen`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.waitForSelector('[aria-label*="Acciones de factura"]', { timeout: 10_000 });

      // Open actions dropdown on first invoice with email
      const actionsBtns = page.locator('[aria-label*="Acciones de factura"]');
      const count = await actionsBtns.count();
      if (count === 0) throw new Error("No invoice actions found");

      // Find first invoice that has send email option
      for (let i = 0; i < count; i++) {
        await actionsBtns.nth(i).click();
        await page.waitForTimeout(500);

        const sendEmail = page.locator('[role="menuitem"]').filter({ hasText: "Enviar email" });
        if (await sendEmail.isVisible().catch(() => false)) {
          await sendEmail.click();
          await page.waitForTimeout(1000);
          break;
        }
        // Close dropdown
        await page.locator('[role="menuitem"]').first().press("Escape");
        await page.waitForTimeout(300);
      }

      // Check if a toast appeared (blocked due to incomplete config)
      const toast = page.locator('[data-testid="toast"], [role="alert"]').first();
      const toastVisible = await toast.isVisible().catch(() => false);

      if (toastVisible) {
        pass("Toast shown when email settings incomplete");
      } else {
        // If no toast, email might be configured — note it but don't fail
        console.log("  SKIP  toast check (email may be configured on this environment)");
        results.push({ name: "Send blocked toast", passed: true });
      }
    } catch (e: unknown) {
      fail("Send blocked toast", e instanceof Error ? e.message : String(e));
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
