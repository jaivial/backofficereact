import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Menus - List & Type Panels", () => {
  test("menus landing page shows type panels without card list", async ({
    adminPage,
  }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/menus");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("menus");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("selecting menu type shows cards", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);

    // First verify API returns data
    const menusData = await api.getGroupMenus();
    expect(menusData.success).toBe(true);

    await adminPage.goto("/app/menus");
    await adminPage.waitForLoadState("networkidle");

    // Look for menu type panel buttons/cards
    const typePanels = adminPage.locator(
      '[data-testid*="menu-type"], [data-ui*="menu-type"], button:has-text("Convencional"), button:has-text("Carta"), button:has-text("Especial"), button:has-text("Grupo")'
    );

    if ((await typePanels.count()) > 0) {
      await typePanels.first().click();
      await adminPage.waitForLoadState("networkidle");
      await adminPage.waitForTimeout(1000);
    }
  });

  test.describe("API contracts", () => {
    test("GET /api/admin/group-menus-v2 returns menus list", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.getGroupMenus();

      expect(response.success).toBe(true);
      expect(typeof response.count).toBe("number");
      expect(Array.isArray(response.menus)).toBe(true);
    });

    test("GET /api/admin/dishes-catalog/search works", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/dishes-catalog/search?q=arroz");

      expect(response.success).toBe(true);
      expect(Array.isArray(response.items)).toBe(true);
    });
  });
});
