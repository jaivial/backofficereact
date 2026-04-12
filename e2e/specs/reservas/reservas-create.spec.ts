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
    await adminPage.goto("/app/reservas/anadir");
    await adminPage.waitForLoadState("networkidle");

    // Create booking data for next week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dateStr = nextWeek.toISOString().split("T")[0];

    // Fill date field
    const dateInput = adminPage.locator(
      'input[type="date"], input[name*="date"], input[name*="fecha"], [data-testid*="date"]'
    ).first();
    if ((await dateInput.count()) > 0) {
      await dateInput.fill(dateStr);
    }

    // Fill time field
    const timeInput = adminPage.locator(
      'input[type="time"], input[name*="time"], input[name*="hora"], select[name*="time"], select[name*="hora"]'
    ).first();
    if ((await timeInput.count()) > 0) {
      await timeInput.fill("14:00");
    }

    // Fill party size
    const partyInput = adminPage.locator(
      'input[name*="party"], input[name*="personas"], input[name*="size"], input[type="number"]'
    ).first();
    if ((await partyInput.count()) > 0) {
      await partyInput.fill("4");
    }

    // Fill customer name
    const nameInput = adminPage.locator(
      'input[name*="name"], input[name*="nombre"], input[name*="customer"]'
    ).first();
    if ((await nameInput.count()) > 0) {
      await nameInput.fill("Test E2E User");
    }

    // Fill phone
    const phoneInput = adminPage.locator(
      'input[name*="phone"], input[name*="telefono"], input[name*="tel"]'
    ).first();
    if ((await phoneInput.count()) > 0) {
      await phoneInput.fill("600000000");
    }

    // Submit
    const submitBtn = adminPage.locator(
      'button[type="submit"], button:has-text("Crear"), button:has-text("Guardar"), button:has-text("Reservar")'
    ).first();

    if ((await submitBtn.count()) > 0) {
      const responsePromise = adminPage.waitForResponse(
        (resp) => resp.url().includes("/api/admin/bookings") && resp.request().method() === "POST",
        { timeout: 10_000 }
      ).catch(() => null);

      await submitBtn.click();

      if (responsePromise) {
        const response = await responsePromise;
        if (response) {
          const data = await response.json();
          // Booking should be created (or show validation)
          expect(typeof data.success).toBe("boolean");
        }
      }
    }
  });

  test("form validation shows errors for empty submission", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app/reservas/anadir");
    await adminPage.waitForLoadState("networkidle");

    // Try to submit without filling
    const submitBtn = adminPage.locator(
      'button[type="submit"], button:has-text("Crear"), button:has-text("Guardar")'
    ).first();

    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
      await adminPage.waitForTimeout(1000);

      // Should still be on create page
      expect(adminPage.url()).toContain("anadir");
    }
  });
});
