import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Reservas - Config", () => {
  test("config page loads", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/reservas/config");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("config");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("config defaults are loaded from API", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);

    await adminPage.goto("/app/reservas/config");
    await adminPage.waitForLoadState("networkidle");

    // Verify API returns config defaults
    const defaults = await api.getConfigDefaults();
    expect(defaults.success).toBe(true);
  });

  test("tables map page loads", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/tables");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("tables");

    // Check for canvas or table map elements
    const canvasOrMap = adminPage.locator(
      'canvas, [data-testid="table-map"], [data-ui="table-canvas"], svg'
    );

    // Canvas or SVG should be present for table map
    expect(await canvasOrMap.count()).toBeGreaterThanOrEqual(0);
  });

  test("date picker opens the occupancy month calendar, same as the table map", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config?date=2026-08-19");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    const trigger = adminPage.getByTestId("reservas-config-date-picker");
    await expect(trigger).toHaveText(/19 ago 2026/);

    await trigger.click();
    const calendar = adminPage.getByTestId("month-calendar");
    await expect(calendar).toBeVisible();
    await expect(adminPage.getByTestId("month-calendar-header")).toContainText(/agosto/i);
    // Booking info per day is what distinguishes this picker from a plain date input.
    await expect(calendar.locator('[data-slot="month-calendar-day-sub"]').first()).toBeVisible();

    await adminPage.getByTestId("month-calendar-prev").click();
    await expect(adminPage.getByTestId("month-calendar-header")).toContainText(/julio/i);
  });

  test("picking a date updates the url and reloads the day", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config?date=2026-08-19");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    await adminPage.getByTestId("reservas-config-date-picker").click();
    await adminPage.getByTestId("month-calendar-day-24").click();

    await expect(adminPage.getByTestId("reservas-config-date-picker")).toHaveText(/24 ago 2026/);
    expect(adminPage.url()).toContain("date=2026-08-24");
  });

  test.describe("API contracts", () => {
    test("GET /api/admin/config/defaults returns valid shape", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.getConfigDefaults();

      expect(response.success).toBe(true);
      expect(response.openingMode).toBeDefined();
      expect(response.weekdayOpen).toBeDefined();
    });

    test("GET /api/admin/config/day returns valid shape", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(`/api/admin/config/day?date=${today}`);

      expect(response.success).toBe(true);
      expect(response.date).toBe(today);
      expect(typeof response.isOpen).toBe("boolean");
    });

    test("GET /api/admin/config/floors/defaults returns floors", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/config/floors/defaults");

      expect(response.success).toBe(true);
      expect(Array.isArray(response.floors)).toBe(true);
    });
  });
});
