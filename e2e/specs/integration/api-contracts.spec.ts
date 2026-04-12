import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";
import { TestApiClient } from "../../helpers/api-client";

test.describe("Integration - API Contracts", () => {
  let api: TestApiClient;

  test.beforeEach(async ({ adminPage }) => {
    api = new TestApiClient(adminPage);
    // Ensure we're on a page where fetch works
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });
  });

  test.describe("Auth endpoints", () => {
    test("POST /api/admin/login - success", async ({ adminPage }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: "admin@hotmail.com",
            password: "admin123123",
          }),
        });
        return { status: res.status, data: await res.json() };
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.session.user).toBeDefined();
      expect(response.data.session.user.email).toBe("admin@hotmail.com");
      expect(response.data.session.user.role).toBe("root");
      expect(response.data.session.user.roleImportance).toBe(100);
      expect(response.data.session.user.sectionAccess).toBeInstanceOf(Array);
      expect(response.data.session.restaurants).toBeInstanceOf(Array);
      expect(response.data.session.activeRestaurantId).toBeDefined();
    });

    test("POST /api/admin/login - wrong password", async ({ adminPage }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: "admin@hotmail.com",
            password: "wrong",
          }),
        });
        return { status: res.status, data: await res.json() };
      });

      expect(response.data.success).toBe(false);
      expect(response.data.message).toContain("invalidas");
    });

    test("POST /api/admin/login - empty fields", async ({ adminPage }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: "", password: "" }),
        });
        return { status: res.status, data: await res.json() };
      });

      expect(response.data.success).toBe(false);
    });

    test("GET /api/admin/me - authenticated", async ({ adminPage }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return { status: res.status, data: await res.json() };
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.session.user.email).toBe("admin@hotmail.com");
    });

    test("POST /api/admin/logout - clears session", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      // Login first
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.waitForSelector("form", { timeout: 15_000 });
      await page.fill('input[type="text"]', "admin@hotmail.com");
      await page.fill('input[type="password"]', "admin123123");
      await page.click('button[type="submit"]');
      await page.waitForURL("**/app/**", { timeout: 15_000 });

      // Logout
      const logoutRes = await page.evaluate(async () => {
        const res = await fetch("/api/admin/logout", {
          method: "POST",
          credentials: "include",
        });
        return await res.json();
      });

      expect(logoutRes.success).toBe(true);

      // Verify session is cleared
      const meRes = await page.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return res.status;
      });

      expect(meRes).toBe(401);

      await context.close();
    });
  });

  test.describe("Bookings endpoints", () => {
    test("GET /api/admin/bookings - with date", async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.getBookings(today);

      expect(response.success).toBe(true);
      expect(Array.isArray(response.bookings)).toBe(true);
      expect(typeof response.total_count).toBe("number");
      expect(typeof response.page).toBe("number");
    });

    test("GET /api/admin/bookings - without date returns error", async ({
      adminPage,
    }) => {
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/bookings", {
          credentials: "include",
        });
        return { status: res.status, data: await res.json() };
      });

      // Should require date parameter
      expect(response.data.success).toBe(false);
    });

    test("GET /api/admin/bookings/search - with name", async () => {
      const response = await api.get("/api/admin/bookings/search?name=test");
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/bookings/export - with date", async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(`/api/admin/bookings/export?date=${today}`);
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/arroz-types returns array", async () => {
      const response = await api.get("/api/admin/arroz-types");
      expect(Array.isArray(response)).toBe(true);
    });
  });

  test.describe("Comida endpoints", () => {
    test("GET /api/admin/comida/platos - paginated", async () => {
      const response = await api.getComida("platos");

      expect(response.success).toBe(true);
      expect(Array.isArray(response.items)).toBe(true);
      expect(typeof response.total).toBe("number");
      expect(typeof response.page).toBe("number");
      expect(typeof response.pageSize).toBe("number");
    });

    test("GET /api/admin/comida/vinos - paginated", async () => {
      const response = await api.getComida("vinos");
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/comida/platos/categorias", async () => {
      const response = await api.get("/api/admin/comida/platos/categorias");
      expect(response.success).toBe(true);
      expect(Array.isArray(response.categories || response.categorias || response.tipos)).toBe(true);
    });
  });

  test.describe("Members endpoints", () => {
    test("GET /api/admin/members", async () => {
      const response = await api.getMembers();
      expect(response.success).toBe(true);
      expect(Array.isArray(response.members)).toBe(true);
    });

    test("GET /api/admin/roles", async () => {
      const response = await api.get("/api/admin/roles");
      expect(response.success).toBe(true);
      expect(Array.isArray(response.roles)).toBe(true);
      expect(response.currentUser).toBeDefined();
    });
  });

  test.describe("Fichaje endpoints", () => {
    test("GET /api/admin/fichaje/state", async () => {
      const response = await api.getFichajeState();
      expect(response.success).toBe(true);
      expect(response.state).toBeDefined();
    });

    test("GET /api/admin/fichaje/ping", async () => {
      const response = await api.get("/api/admin/fichaje/ping");
      expect(response.success).toBe(true);
    });
  });

  test.describe("Config endpoints", () => {
    test("GET /api/admin/config/defaults", async () => {
      const response = await api.getConfigDefaults();
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/day", async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(`/api/admin/config/day?date=${today}`);
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/opening-hours", async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(
        `/api/admin/config/opening-hours?date=${today}`
      );
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/daily-limit", async () => {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(
        `/api/admin/config/daily-limit?date=${today}`
      );
      expect(response.success).toBe(true);
    });

    test("GET /api/admin/config/floors/defaults", async () => {
      const response = await api.get("/api/admin/config/floors/defaults");
      expect(response.success).toBe(true);
      expect(Array.isArray(response.floors)).toBe(true);
    });
  });

  test.describe("Calendar endpoint", () => {
    test("GET /api/admin/calendar - with params", async () => {
      const now = new Date();
      const response = await api.get(
        `/api/admin/calendar?year=${now.getFullYear()}&month=${now.getMonth() + 1}`
      );
      expect(response.success).toBe(true);
    });
  });
});
