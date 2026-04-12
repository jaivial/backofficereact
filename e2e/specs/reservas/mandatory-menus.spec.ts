import { test, expect } from "../../fixtures/session";

// Skip: mandatory menus config UI is not yet fully implemented
test.describe.skip("Reservas Config - Mandatory Menus", () => {
  test("toggle switch shows menu selector when turned on", async ({ adminPage }) => {
    // Navigate to reservas config
    await adminPage.goto("/app/reservas/config?date=2026-04-05");
    await adminPage.waitForLoadState("networkidle");

    // Toggle switch should exist
    const toggle = adminPage.getByRole("switch", { name: /activar menus obligatorios/i });
    await expect(toggle).toBeVisible();

    // Toggle off by default
    await expect(toggle).not.toBeChecked();

    // Turn toggle on
    await toggle.click();

    // Menu selector wrapper should appear
    const selectorWrapper = adminPage.getByTestId("menu-selector-wrapper");
    await expect(selectorWrapper).toBeVisible();

    // Add menu button should be visible
    const addBtn = adminPage.getByTestId("add-menu-btn");
    await expect(addBtn).toBeVisible();
  });

  test("saves mandatory menu configuration", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config?date=2026-04-05");
    await adminPage.waitForLoadState("networkidle");

    // Toggle on
    await adminPage.getByRole("switch", { name: /activar menus obligatorios/i }).click();

    // Wait for selector
    await adminPage.getByTestId("menu-selector-wrapper").waitFor({ state: "visible" });

    // Add menu button
    await adminPage.getByTestId("add-menu-btn").click();

    // Select a menu from dropdown
    const firstMenuRow = adminPage.getByTestId("menu-row").first();
    await expect(firstMenuRow).toBeVisible();

    // Click save
    await adminPage.getByRole("button", { name: "Guardar" }).click();

    // Should show success toast
    await expect(adminPage.locator('[data-toast-kind="success"]')).toBeVisible({ timeout: 5000 });
  });

  test("shows principals checkbox when menu selected", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config?date=2026-04-05");
    await adminPage.waitForLoadState("networkidle");

    // Turn on toggle
    await adminPage.getByRole("switch", { name: /activar menus obligatorios/i }).click();

    // Wait for selector and add a menu
    await expect(adminPage.getByTestId("menu-selector-wrapper")).toBeVisible();
    await adminPage.getByTestId("add-menu-btn").click();

    // Check principals checkbox appears
    const principalsCheckbox = adminPage.getByTestId("choose-main-checkbox");
    await expect(principalsCheckbox).toBeVisible();
  });
});
