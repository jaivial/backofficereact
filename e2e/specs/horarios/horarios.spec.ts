import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Horarios - Schedules", () => {
  test("horarios page loads with calendar", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/horarios");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("horarios");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("horarios month API returns data", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const now = new Date();
    const response = await api.get(
      `/api/admin/horarios/month?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
    );

    expect(response.success).toBe(true);
    expect(response.year).toBeDefined();
    expect(response.month).toBeDefined();
    expect(Array.isArray(response.days)).toBe(true);
  });

  test("horarios day API returns schedules", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const today = new Date().toISOString().split("T")[0];
    const response = await api.getHorarios(today);

    expect(response.success).toBe(true);
    expect(response.date).toBe(today);
    expect(Array.isArray(response.schedules)).toBe(true);
  });

  test.describe("API contracts", () => {
    test("POST /api/admin/horarios creates schedule", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const members = await api.getMembers();

      if (members.success && members.members.length > 0) {
        const memberId = members.members[0].id;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 365 + (Date.now() % 300));
        const dateStr = tomorrow.toISOString().split("T")[0];

        const response = await api.post("/api/admin/horarios", {
          date: dateStr,
          memberId,
          startTime: "09:00",
          endTime: "17:00",
        });

        expect(response.success).toBe(true);
        expect(response.schedule).toBeDefined();
      }
    });

    test("schedule with end before start returns error", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const members = await api.getMembers();

      if (members.success && members.members.length > 0) {
        const memberId = members.members[0].id;
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 365 + (Date.now() % 300));
        const dateStr = tomorrow.toISOString().split("T")[0];

        const response = await api.post("/api/admin/horarios", {
          date: dateStr,
          memberId,
          startTime: "17:00",
          endTime: "09:00",
        });

        expect(response.success).toBe(false);
        expect(response.message).toBeDefined();
      }
    });
  });
});
