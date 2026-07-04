/**
 * E2E: InfoModal close on reservas config page.
 *
 * Bug: "Cerrar" button and backdrop click did not close the modal.
 * Root cause: onInfoToggle handler was () => setShowMandatoryInfo(true),
 * wired to both the open button AND InfoModal's onClose prop.
 * Fix: separate onInfoClose = () => setShowMandatoryInfo(false).
 *
 * Runs against backoffice-dev via UI login (self-contained, no session fixture).
 */
import { test, expect } from "@playwright/test";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const TODAY = new Date().toISOString().slice(0, 10);

async function login(page: import("@playwright/test").Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

test.describe("Reservas Config - Info Modal", () => {
  test("opens info modal and closes via Cerrar button", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`);
    await page.waitForLoadState("networkidle");

    // Toggle "Reserva de menus" on
    const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    // Wait for info button in the expanded section
    const infoBtn = page.getByRole("button", { name: "Más información" });
    await expect(infoBtn).toBeVisible({ timeout: 5000 });

    // Click info button → modal opens
    await infoBtn.click();

    // Verify modal is visible with correct title
    const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Verify Cerrar button is inside dialog
    const cerrarBtn = dialog.getByRole("button", { name: "Cerrar" });
    await expect(cerrarBtn).toBeVisible();

    // Click Cerrar → modal closes
    await cerrarBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    await context.close();
  });

  test("opens info modal and closes via backdrop click", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`);
    await page.waitForLoadState("networkidle");

    const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
    await toggle.click();

    const infoBtn = page.getByRole("button", { name: "Más información" });
    await expect(infoBtn).toBeVisible({ timeout: 5000 });
    await infoBtn.click();

    const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Click backdrop corner — Modal.tsx overlay uses .fixed.inset-0 as wrapper
    await page.locator(".fixed.inset-0").first().click({
      position: { x: 10, y: 10 },
    });
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    await context.close();
  });

  test("opens info modal and closes via Escape key", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`);
    await page.waitForLoadState("networkidle");

    const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
    await toggle.click();

    const infoBtn = page.getByRole("button", { name: "Más información" });
    await expect(infoBtn).toBeVisible({ timeout: 5000 });
    await infoBtn.click();

    const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    await context.close();
  });

  test("modal reopens correctly after close", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`);
    await page.waitForLoadState("networkidle");

    const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
    await toggle.click();

    const infoBtn = page.getByRole("button", { name: "Más información" });
    await expect(infoBtn).toBeVisible({ timeout: 5000 });

    // Open → close → reopen cycle (3 times)
    for (let i = 0; i < 3; i++) {
      await infoBtn.click();
      const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
      await expect(dialog).toBeVisible({ timeout: 3000 });

      const cerrarBtn = dialog.getByRole("button", { name: "Cerrar" });
      await cerrarBtn.click();
      await expect(dialog).not.toBeVisible({ timeout: 3000 });
    }

    await context.close();
  });

  test("modal closes on mobile viewport via Cerrar", async ({ browser }) => {
    const context = await browser.newContext({
      ...browser.browserType().executionContext()?.constructor?.prototype,
      ignoreHTTPSErrors: true,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await login(page);
    await page.goto(`${BASE_URL}/app/reservas/config?date=${TODAY}`);
    await page.waitForLoadState("networkidle");

    const toggle = page.getByRole("switch", { name: /activar menús obligatorios/i });
    await toggle.click();

    const infoBtn = page.getByRole("button", { name: "Más información" });
    await expect(infoBtn).toBeVisible({ timeout: 5000 });
    await infoBtn.click();

    const dialog = page.getByRole("dialog", { name: "Reserva obligatoria" });
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // On mobile, Cerrar button should be tappable
    const cerrarBtn = dialog.getByRole("button", { name: "Cerrar" });
    await expect(cerrarBtn).toBeVisible();
    await cerrarBtn.click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    await context.close();
  });
});
