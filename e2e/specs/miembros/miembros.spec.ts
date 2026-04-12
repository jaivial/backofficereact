import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient, type MemberResponse } from "../../helpers/api-client";

test.describe("Miembros - Members", () => {
  test("miembros page loads with member list", async ({ adminPage }) => {
    const consoleCapture = captureConsole(adminPage);

    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("miembros");

    const errorCheck = assertNoCriticalErrors(consoleCapture);
    expect(errorCheck.hasErrors).toBeFalsy();
  });

  test("members API returns data", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.getMembers();

    expect(response.success).toBe(true);
    expect(Array.isArray(response.members)).toBe(true);
  });

  test("roles tab loads", async ({ adminPage }) => {
    await adminPage.goto("/app/miembros/roles");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    expect(adminPage.url()).toContain("roles");
  });

  test("roles API returns catalog", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const response = await api.get("/api/admin/roles");

    expect(response.success).toBe(true);
    expect(Array.isArray(response.roles)).toBe(true);
    expect(response.currentUser).toBeDefined();
  });

  test("can view member detail", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const members = await api.getMembers();

    if (members.success && members.members.length > 0) {
      const memberId = members.members[0].id;
      const response = await api.get<MemberResponse>(`/api/admin/members/${memberId}`);

      expect(response.success).toBe(true);
      expect(response.member).toBeDefined();
      expect((response.member as { id: number }).id).toBe(memberId);
    }
  });

  test("member stats API returns data", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const members = await api.getMembers();

    if (members.success && members.members.length > 0) {
      const memberId = members.members[0].id;
      const response = await api.get(
        `/api/admin/members/${memberId}/stats?view=weekly`
      );

      expect(response.success).toBe(true);
    }
  });

  test("member time balance API returns data", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const members = await api.getMembers();

    if (members.success && members.members.length > 0) {
      const memberId = members.members[0].id;
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(
        `/api/admin/members/${memberId}/time-balance?date=${today}`
      );

      expect(response.success).toBe(true);
    }
  });

  test.describe("Red scenarios", () => {
    test("non-admin cannot access members (camarero)", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      // Login as camarero
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.waitForSelector("form", { timeout: 15_000 });
      await page.fill('input[type="text"]', "testcamarero@test.com");
      await page.fill('input[type="password"]', "admin123123");
      await page.click('button[type="submit"]');

      // Wait for either successful login or remaining on login page
      await page.waitForTimeout(3000);

      const currentUrl = page.url();

      if (currentUrl.includes("/app")) {
        // Camarero logged in successfully - test RBAC
        const response = await page.evaluate(async () => {
          const res = await fetch("/api/admin/members", {
            credentials: "include",
          });
          return { status: res.status, data: await res.json() };
        });

        // Should be forbidden (403) or unauthorized
        expect([401, 403]).toContain(response.status);
      } else {
        // Camarero can't log in (user may not exist) - verify API directly
        // by checking that the /api/admin/members endpoint requires auth
        const response = await page.evaluate(async () => {
          const res = await fetch("/api/admin/members", {
            credentials: "include",
          });
          return { status: res.status };
        });
        expect([401, 403]).toContain(response.status);
      }

      await context.close();
    });
  });
});
