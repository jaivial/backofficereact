import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Config > IA > MiniMax", () => {
  test("IA tab shows the MiniMax config panel", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/config?content=ia");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.getByTestId("config-minimax")).toBeVisible();
    await expect(adminPage.getByTestId("config-minimax-key-input")).toBeVisible();
    await expect(adminPage.getByTestId("config-minimax-save-btn")).toBeVisible();

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("GET /api/admin/config/minimax contract", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.get<{
      success: boolean;
      config?: { hasApiKey?: boolean; model?: string };
    }>("/api/admin/config/minimax");

    expect(response.success).toBe(true);
    expect(response.config).toBeDefined();
    expect(typeof response.config?.hasApiKey).toBe("boolean");
    expect(typeof response.config?.model).toBe("string");
    // The API key must never be exposed.
    expect(JSON.stringify(response).toLowerCase()).not.toContain("api_key_encrypted");
  });
});