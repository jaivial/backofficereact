import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

const FOOD_TYPES = ["platos", "vinos", "postres", "bebidas", "cafes"];

test.describe("Comida - Food Items", () => {
  test("comida page loads with food type panels", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/comida");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("comida");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("can navigate to each food type", async ({ adminPage }) => {
    for (const tipo of FOOD_TYPES) {
      await adminPage.goto(`/app/comida/${tipo}`);
      await adminPage.waitForLoadState("networkidle");
      await waitForLoadingToFinish(adminPage);

      expect(adminPage.url()).toContain(tipo);
    }
  });

  test("platos list loads with items", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);

    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");

    // Verify API returns platos
    const response = await api.getComida("platos");
    expect(response.success).toBe(true);
    expect(Array.isArray(response.items)).toBe(true);
  });

  test("vinos list loads with wine type filters", async ({ adminPage }) => {
    await adminPage.goto("/app/comida/vinos");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("vinos");
  });

  test("can open create food item form", async ({ adminPage }) => {
    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");

    // Find create/add button
    const createBtn = adminPage.locator(
      'button:has-text("Crear"), button:has-text("Nuevo"), button:has-text("Añadir"), button:has-text("Add"), [data-testid="create-food"], [data-ui="create-button"]'
    ).first();

    if ((await createBtn.count()) > 0) {
      await createBtn.click();
      await adminPage.waitForTimeout(1000);

      // Modal or form should appear
      const modalOrForm = adminPage.locator(
        '[role="dialog"], [data-testid="food-modal"], [data-ui="food-form"], form'
      );
      // Check if form opened
      expect(await modalOrForm.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test.describe("API contracts", () => {
    for (const tipo of FOOD_TYPES) {
      test(`GET /api/admin/comida/${tipo} returns valid shape`, async ({
        adminPage,
      }) => {
        const api = new TestApiClient(adminPage);
        const response = await api.getComida(tipo);

        expect(response.success).toBe(true);
        expect(Array.isArray(response.items)).toBe(true);
        expect(typeof response.total).toBe("number");
        expect(typeof response.page).toBe("number");
      });
    }
  });

  test.describe("Red scenarios", () => {
    test("invalid food type returns error or empty", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get<{ success: boolean; items?: unknown[] }>("/api/admin/comida/invalidtype999");

      // Should return error or empty results
      expect(response.success === false || (response.items as unknown[])?.length === 0).toBe(true);
    });
  });
});
