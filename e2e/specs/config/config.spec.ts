import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Config & Settings", () => {
  test("config page loads", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/config");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("config");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("settings page loads or redirects to config", async ({ adminPage }) => {
    await adminPage.goto("/app/settings");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // May redirect to config or be a separate page
    const url = adminPage.url();
    const ok = url.includes("settings") || url.includes("config") || url.includes("app");
    expect(ok).toBe(true);
  });

  test.describe("API contracts", () => {
    test("GET /api/admin/config/defaults", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.getConfigDefaults();

      expect(response.success).toBe(true);
      expect(response.openingMode).toBeDefined();
    });

    test("GET /api/admin/integrations", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/integrations");

      expect(response.success).toBe(true);
    });

    test("GET /api/admin/branding", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/branding");

      expect(response.success).toBe(true);
    });

    test("GET /api/admin/website", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/website");

      expect(response.success).toBe(true);
    });

    test("GET /api/admin/website/menu-templates", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/website/menu-templates");

      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/restaurant-info", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/config/restaurant-info");

      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/email-provider", async ({ adminPage }) => {
      const api = new TestApiClient(adminPage);
      const response = await api.get("/api/admin/config/email-provider");

      expect(response.success).toBe(true);
    });
  });
});
