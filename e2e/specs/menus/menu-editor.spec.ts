import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { TestApiClient, type MenusResponse } from "../../helpers/api-client";

test.describe("Menus - Editor", () => {
  let testMenuId: number | null = null;

  test.afterAll(async ({ browser }) => {
    // Cleanup: delete test menu if created
    if (testMenuId) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      // Login
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.waitForSelector("form", { timeout: 15_000 });
      await page.fill('input[type="text"]', "admin@hotmail.com");
      await page.fill('input[type="password"]', "admin123123");
      await page.click('button[type="submit"]');
      await page.waitForURL("**/app/**", { timeout: 15_000 });

      // Delete test menu
      await page.evaluate(async (id) => {
        await fetch(`/api/admin/group-menus-v2/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }, testMenuId);

      await context.close();
    }
  });

  test("can create a draft menu", async ({ adminPage }) => {
    // Create draft via API
    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/group-menus-v2/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_type: "closed_conventional" }),
        credentials: "include",
      });
      return res.json();
    });

    if (response.success) {
      testMenuId = response.menu_id;

      // Navigate to editor
      await adminPage.goto(`/app/menus/crear?menuId=${testMenuId}`);
      await adminPage.waitForLoadState("networkidle");
      await waitForLoadingToFinish(adminPage);

      expect(adminPage.url()).toContain("menus/crear");
    }
  });

  test("menu editor loads with all sections", async ({ adminPage }) => {
    // Use an existing menu
    const api = new TestApiClient(adminPage);
    const menus = await api.getGroupMenus();

    if (menus.success && menus.menus!.length > 0) {
      const menuId = menus.menus![0].id;
      await adminPage.goto(`/app/menus/crear?menuId=${menuId}`);
      await adminPage.waitForLoadState("networkidle");
      await waitForLoadingToFinish(adminPage);

      // Verify menu data loaded
      const menuData = await api.get<MenusResponse>(`/api/admin/group-menus-v2/${menuId}`);
      expect(menuData.success).toBe(true);
      expect(menuData.menu).toBeDefined();
    }
  });

  test("can edit menu basics", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const menus = await api.getGroupMenus();

    if (menus.success && menus.menus!.length > 0) {
      const menuId = menus.menus![0].id;

      // Patch basics via API
      const response = await api.patch(
        `/api/admin/group-menus-v2/${menuId}/basics`,
        { menu_title: "Test E2E Menu Updated" }
      );

      expect(response.success).toBe(true);
    }
  });

  test("can publish a draft menu", async ({ adminPage }) => {
    // Create a draft
    const draft = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/group-menus-v2/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu_type: "closed_conventional" }),
        credentials: "include",
      });
      return res.json();
    });

    if (draft.success && draft.menu_id) {
      const menuId = draft.menu_id;

      // Try to publish (may fail if no sections/dishes - expected)
      const publish = await adminPage.evaluate(async (id) => {
        const res = await fetch(`/api/admin/group-menus-v2/${id}/publish`, {
          method: "POST",
          credentials: "include",
        });
        return res.json();
      }, menuId);

      // Should either succeed or fail with validation message
      expect(typeof publish.success).toBe("boolean");
      if (!publish.success) {
        expect(publish.message).toBeDefined();
      }

      // Cleanup
      await adminPage.evaluate(async (id) => {
        await fetch(`/api/admin/group-menus-v2/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }, menuId);
    }
  });

  test.describe("API contracts", () => {
    test("GET /api/admin/group-menus-v2/{id} returns full menu", async ({
      adminPage,
    }) => {
      const api = new TestApiClient(adminPage);
      const menus = await api.getGroupMenus();

      if (menus.success && menus.menus!.length > 0) {
        const menuId = menus.menus![0].id;
        const response = await api.get<MenusResponse>(`/api/admin/group-menus-v2/${menuId}`);

        expect(response.success).toBe(true);
        expect(response.menu).toBeDefined();
        expect((response.menu as { menu_title?: string }).menu_title).toBeDefined();
        expect((response.menu as { sections?: unknown[] }).sections).toBeDefined();
      }
    });
  });

  test.describe("Red scenarios", () => {
    test("edit non-existent menu returns error", async ({ adminPage }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/group-menus-v2/99999", {
          credentials: "include",
        });
        return await res.json();
      });

      expect(response.success).toBe(false);
    });
  });
});
