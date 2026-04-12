import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Fichaje - Time Tracking", () => {
  test("fichaje page loads", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/fichaje");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("fichaje");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("fichaje state API returns data", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.getFichajeState();

    expect(response.success).toBe(true);
    expect(response.state).toBeDefined();
    expect(response.state.now).toBeDefined();
  });

  test("fichaje ping API responds", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.get("/api/admin/fichaje/ping");

    expect(response.success).toBe(true);
    expect(response.message).toBe("fichaje_ready");
  });

  test("fichaje entries API works", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const members = await api.getMembers();

    if (members.success && members.members.length > 0) {
      const memberId = members.members[0].id;
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(
        `/api/admin/fichaje/entries?memberId=${memberId}&date=${today}`
      );

      expect(response.success).toBe(true);
      expect(Array.isArray(response.entries)).toBe(true);
    }
  });

  test.describe("Red scenarios", () => {
    test("clock out without active entry returns error", async ({
      adminPage,
    }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/fichaje/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        return await res.json();
      });

      // Should fail since there's no active entry
      expect(response.success).toBe(false);
    });
  });
});
