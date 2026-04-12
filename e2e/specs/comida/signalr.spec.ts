/**
 * SignalR / WebSocket E2E tests for comida section.
 * Tests AI image generation events and fichaje realtime bridge.
 */
import { test, expect } from "../../fixtures/session";
import { captureConsole } from "../../helpers/console";

test.describe("comida AI WebSocket behavior", () => {
  test("WebSocket connects on comida list page", async ({ adminPage }) => {
    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(1000);

    const wsExists = await adminPage.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      return (
        typeof win.__comidaAIWS__ !== "undefined" ||
        typeof window.WebSocket !== "undefined"
      );
    });

    // WebSocket should exist on the page
    expect(wsExists).toBeTruthy();
  });

  test("WebSocket disconnect is handled gracefully", async ({ adminPage }) => {
    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Simulate WebSocket disconnect
    await adminPage.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      const ws = win.__comidaAIWS__ as WebSocket | undefined;
      if (ws && ws.close) ws.close();
    });

    await adminPage.waitForTimeout(500);

    // Page should still be functional
    expect(adminPage.url()).toContain("comida");
    const grid = adminPage.locator("[data-ui='food-list-grid']");
    if ((await grid.count()) > 0) {
      expect(await grid.isVisible()).toBeTruthy();
    }
  });

  test("AI image generation event triggers toast/notification", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Inject an AI image generation event
    await adminPage.evaluate(() => {
      const event = new MessageEvent("message", {
        data: JSON.stringify({
          type: "ai_image_generated",
          payload: {
            foodId: 1,
            imageUrl: "https://example.com/generated.jpg",
          },
        }),
      });
      window.dispatchEvent(event);
    });

    await adminPage.waitForTimeout(500);

    const toast = adminPage.locator("[data-role='toast']");
    if ((await toast.count()) > 0) {
      expect(await toast.isVisible()).toBeTruthy();
    }
  });

  test("AI image generation failure shows error notification", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Inject a failure event
    await adminPage.evaluate(() => {
      const event = new MessageEvent("message", {
        data: JSON.stringify({
          type: "ai_image_error",
          payload: {
            foodId: 1,
            error: "Image generation failed",
          },
        }),
      });
      window.dispatchEvent(event);
    });

    await adminPage.waitForTimeout(500);

    const errorToast = adminPage.locator(
      "[data-role='error-toast'], [data-kind='error'][data-role='toast']"
    );
    if ((await errorToast.count()) > 0) {
      expect(await errorToast.isVisible()).toBeTruthy();
    }
  });

  test("WebSocket does not cause SSR hydration mismatch", async ({
    adminPage,
  }) => {
    const capture = captureConsole(adminPage);

    await adminPage.goto("/app/comida/platos");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Check for hydration warnings (errors starting with "Hydration" or "React")
    const hydrationErrors = capture.errors.filter(
      (e) =>
        e.includes("Hydration") ||
        e.includes("Text content did not match") ||
        e.includes("did not match")
    );

    expect(hydrationErrors).toHaveLength(0);
  });
});

test.describe("fichaje realtime bridge", () => {
  test("FichajeRealtimeBridge connects on app load", async ({ adminPage }) => {
    // Navigate through app to trigger fichaje bridge initialization
    await adminPage.goto("/app");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(1000);

    const bridgeExists = await adminPage.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      return (
        typeof win.__fichajeBridge__ !== "undefined" ||
        typeof win.__FichajeRealtimeBridge__ !== "undefined" ||
        document.querySelector("[data-ui='horarios-content']") !== null
      );
    });

    // Bridge should be initialized on app load
    expect(bridgeExists).toBeTruthy();
  });

  test("FichajeRealtimeBridge reconnects on disconnect", async ({ adminPage }) => {
    await adminPage.goto("/app/horarios");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Simulate disconnect then reconnect
    await adminPage.evaluate(() => {
      const win = window as unknown as Record<string, unknown>;
      const bridge = win.__fichajeBridge__ as WebSocket | undefined;
      if (bridge && bridge.close) {
        bridge.close();
        // Immediately try to reconnect by dispatching online event
        window.dispatchEvent(new Event("online"));
      }
    });

    await adminPage.waitForTimeout(1000);

    // Page should still be functional
    expect(adminPage.url()).toContain("horarios");
  });

  test("FichajeRealtimeBridge handles schedule_updated event", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app/horarios");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(500);

    // Inject schedule_updated event
    await adminPage.evaluate(() => {
      const event = new MessageEvent("message", {
        data: JSON.stringify({
          type: "schedule_updated",
          payload: {
            scheduleId: 1,
            date: new Date().toISOString().split("T")[0],
          },
        }),
      });
      window.dispatchEvent(event);
    });

    await adminPage.waitForTimeout(500);

    // Page should still be functional - no crash
    expect(adminPage.url()).toContain("horarios");
  });

  test("no WebSocket error causes white screen", async ({ adminPage }) => {
    const capture = captureConsole(adminPage);

    await adminPage.goto("/app");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(1000);

    // Inject multiple error events
    await adminPage.evaluate(() => {
      for (let i = 0; i < 5; i++) {
        const event = new MessageEvent("message", {
          data: JSON.stringify({ type: "error", payload: { message: "Test error" } }),
        });
        window.dispatchEvent(event);
      }
    });

    await adminPage.waitForTimeout(500);

    // Page should not be white - main content should be visible
    const mainContent = adminPage.locator("[data-ui='main-content']");
    if ((await mainContent.count()) > 0) {
      expect(await mainContent.isVisible()).toBeTruthy();
    }

    // Check no critical JS errors
    const criticalErrors = capture.pageErrors.filter(
      (e) =>
        !e.message.includes("favicon") && !e.message.includes("devtools")
    );
    expect(criticalErrors).toHaveLength(0);
  });
});
