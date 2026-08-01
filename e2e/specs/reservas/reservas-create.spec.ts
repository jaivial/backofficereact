import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";

test.describe("Reservas - Create Booking", () => {
  test("create booking form loads correctly", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/reservas/anadir");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("anadir");

    // Assert form elements visible
    // Look for form inputs using various strategies
    const formInputs = adminPage.locator(
      'input, select, textarea'
    );
    const inputCount = await formInputs.count();
    expect(inputCount).toBeGreaterThan(0);

    // Check no critical errors
    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("create booking with valid data", async ({ adminPage }) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    await adminPage.goto(`/app/reservas/anadir?date=${todayStr}`);
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // Fill required fields (BookingEditor uses data-slot selectors)
    await adminPage.fill('[data-slot="booking-editor-client-input"]', "Test E2E User");
    await adminPage.fill('[data-slot="booking-editor-phone-input"]', "600000000");

    // Submit should become enabled and create the booking
    const crearBtn = adminPage.locator('[data-slot="booking-editor-submit"]');
    await expect(crearBtn).toBeEnabled();
    await crearBtn.click();

    const successOverlay = adminPage.locator('[data-slot="booking-create-success-overlay"]');
    await expect(successOverlay).toBeVisible({ timeout: 15000 });
  });

  test("form validation shows errors for empty submission", async ({
    adminPage,
  }) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    await adminPage.goto(`/app/reservas/anadir?date=${todayStr}`);
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // Empty form: submit is disabled and the required-fields hint is shown
    const crearBtn = adminPage.locator('[data-slot="booking-editor-submit"]');
    await expect(crearBtn).toBeDisabled();

    const hint = adminPage.locator('[data-slot="booking-editor-required-hint"]');
    await expect(hint).toBeVisible();

    // Still on create page
    expect(adminPage.url()).toContain("anadir");
  });
});
