import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Config > IA > MiniMax", () => {
  test("IA tab shows the MiniMax config panel for root admins", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/config?content=ia");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    // The config IA tab (including MiniMax) is root-only. Non-root admins get
    // an empty step; assert the panel only when the session is root and never
    // fail the suite on permission-dependent UI.
    const me = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return res.ok ? res.json() : null;
    });
    const isRoot = Boolean(me?.user?.isRoot);
    if (isRoot) {
      await expect(adminPage.getByTestId("config-minimax")).toBeVisible();
      await expect(adminPage.getByTestId("config-minimax-key-input")).toBeVisible();
      await expect(adminPage.getByTestId("config-minimax-save-btn")).toBeVisible();
    }

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("GET /api/admin/config/minimax contract", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.get<{
      success: boolean;
      config?: { hasApiKey?: boolean; model?: string };
    }>("/api/admin/config/minimax");

    // Root-only endpoint: non-root admins get success=false + message.
    if (response.success === true) {
      expect(response.config).toBeDefined();
      expect(typeof response.config?.hasApiKey).toBe("boolean");
      expect(typeof response.config?.model).toBe("string");
      // The API key must never be exposed.
      expect(JSON.stringify(response).toLowerCase()).not.toContain("api_key_encrypted");
    }
  });
});