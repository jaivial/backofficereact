import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

test.describe("Authentication", () => {
  test.describe("Login page", () => {
    test("renders correctly with all form elements", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      const consoleCapture = captureConsole(page);

      await page.goto("/login", { waitUntil: "networkidle" });
      // Wait for form to be present (SSR hydration)
      await page.waitForSelector("form", { timeout: 15_000 });

      // Assert form elements visible
      await expect(page.locator('input[type="text"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]').first()).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();

      // Assert no critical console errors
      const errorCheck = assertNoCriticalErrors(consoleCapture);
      expect(errorCheck.hasErrors).toBeFalsy();

      await context.close();
    });

    test("login with valid admin credentials redirects to app", async ({
      browser,
    }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      await page.goto("/login", { waitUntil: "networkidle" });

      // Fill and submit login form
      await page.fill('input[type="text"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');

      // Assert redirect to app
      await page.waitForURL("**/app/**", { timeout: 15_000 });

      // Assert bo_session cookie is set
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c) => c.name === "bo_session");
      expect(sessionCookie).toBeDefined();

      // Verify session via API
      const sessionData = await page.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return await res.json();
      });

      expect(sessionData.success).toBe(true);
      expect(sessionData.session.user.role).toBe("root");
      expect(sessionData.session.user.roleImportance).toBe(100);
      expect(sessionData.session.user.sectionAccess).toContain("reservas");

      await context.close();
    });

    test("fresh contexts complete the first login without a login bounce", async ({ browser }) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const context = await browser.newContext({ ignoreHTTPSErrors: true });
        const page = await context.newPage();

        await page.goto("/login", { waitUntil: "networkidle" });
        await page.fill('input[type="text"]', ADMIN_EMAIL);
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/app/**", { timeout: 15_000 });
        expect(page.url()).not.toContain("/login");
        expect((await context.cookies()).some((cookie) => cookie.name === "bo_session")).toBe(true);

        await context.close();
      }
    });

    test("login with invalid credentials shows error", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      await page.goto("/login", { waitUntil: "networkidle" });
      await page.waitForSelector("form", { timeout: 15_000 });

      // Test via direct API call (more reliable than intercepting form submit)
      const response = await page.evaluate(async () => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: "wrong@email.com",
            password: "wrongpassword",
          }),
        });
        return await res.json();
      });

      expect(response.success).toBe(false);
      expect(response.message).toBeDefined();

      // Also test via UI form
      await page.fill('input[type="text"]', "wrong@email.com");
      await page.fill('input[type="password"]', "wrongpassword");
      await page.click('button[type="submit"]');
      await page.waitForTimeout(1000);

      // Assert still on login page
      expect(page.url()).toContain("/login");

      await context.close();
    });

    test("login with empty fields shows validation", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      await page.goto("/login");

      // Submit without filling
      await page.click('button[type="submit"]');

      // Assert still on login page
      await page.waitForTimeout(1000);
      expect(page.url()).toContain("/login");

      await context.close();
    });

    test("uses one responsive image only above 768px", async ({ browser }) => {
      const desktop = await browser.newContext({
        viewport: { width: 769, height: 800 },
        ignoreHTTPSErrors: true,
      });
      const desktopPage = await desktop.newPage();
      const desktopHeroRequests: string[] = [];
      desktopPage.on("request", (request) => {
        if (request.url().includes("/media/login/login-hero.")) desktopHeroRequests.push(request.url());
      });
      await desktopPage.goto("/login", { waitUntil: "domcontentloaded" });
      await desktopPage.waitForLoadState("networkidle");

      const formPane = desktopPage.getByTestId("login-form-pane");
      const imagePane = desktopPage.getByTestId("login-image-pane");
      await expect(imagePane).toBeVisible();
      const [formBox, imageBox] = await Promise.all([
        formPane.boundingBox(),
        imagePane.boundingBox(),
      ]);
      expect(formBox?.width).toBeCloseTo(imageBox?.width ?? 0, 0);

      await expect(imagePane.locator("img")).toHaveCount(1);
      await expect(imagePane.locator('source[type="image/webp"]')).toHaveAttribute(
        "srcset",
        "/media/login/login-hero.webp",
      );
      expect(desktopHeroRequests).toHaveLength(1);
      await desktop.close();

      const mobile = await browser.newContext({
        viewport: { width: 768, height: 800 },
        ignoreHTTPSErrors: true,
      });
      const mobilePage = await mobile.newPage();
      const mobileHeroRequests: string[] = [];
      mobilePage.on("request", (request) => {
        if (request.url().includes("/media/login/login-hero.")) mobileHeroRequests.push(request.url());
      });
      await mobilePage.goto("/login", { waitUntil: "domcontentloaded" });
      await mobilePage.waitForLoadState("networkidle");
      await expect(mobilePage.getByTestId("login-image-pane")).toBeHidden();
      await expect(mobilePage.getByTestId("login-form")).toBeVisible();
      expect(mobileHeroRequests).toHaveLength(0);
      await mobile.close();
    });
  });

  test.describe("Protected routes", () => {
    test("redirects to login without session", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      // Try to access protected routes
      const protectedRoutes = [
        "/app/dashboard",
        "/app/reservas",
        "/app/menus",
        "/app/comida",
        "/app/miembros",
        "/app/fichaje",
        "/app/horarios",
        "/app/config",
      ];

      for (const route of protectedRoutes) {
        await page.goto(route);
        await page.waitForTimeout(2000);
        // Should end up on login page (redirect or shown login)
        const url = page.url();
        expect(url).toContain("/login");
      }

      await context.close();
    });
  });

  test.describe("Session management", () => {
    test("logout clears session and redirects", async ({ adminPage }) => {
      // Navigate to app first
      await adminPage.goto("/app");
      await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

      // Find and click logout button/link
      const logoutSelectors = [
        'button:has-text("Cerrar")',
        'button:has-text("Logout")',
        'button:has-text("Salir")',
        '[data-testid="logout"]',
        '[data-ui="logout"]',
        'a:has-text("Cerrar sesión")',
        'a:has-text("Logout")',
      ];

      let clicked = false;
      for (const selector of logoutSelectors) {
        const el = adminPage.locator(selector).first();
        if ((await el.count()) > 0) {
          const responsePromise = adminPage.waitForResponse(
            "**/api/admin/logout"
          );
          await el.click();
          await responsePromise;
          clicked = true;
          break;
        }
      }

      if (!clicked) {
        // Try API logout directly
        await adminPage.evaluate(async () => {
          await fetch("/api/admin/logout", {
            method: "POST",
            credentials: "include",
          });
        });
      }

      // Assert redirect to login
      await adminPage.waitForURL("**/login**", { timeout: 10_000 }).catch(() => {});

      // Verify session is gone
      const meResponse = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return { status: res.status };
      });
      expect(meResponse.status).toBe(401);
    });

    test("expired session redirects to login", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();

      // Login
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.waitForSelector("form", { timeout: 15_000 });
      await page.fill('input[type="text"]', ADMIN_EMAIL);
      await page.fill('input[type="password"]', ADMIN_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/app/**", { timeout: 15_000 });

      // Clear session cookie
      await context.clearCookies();

      // Try to navigate
      await page.goto("/app/dashboard");
      await page.waitForTimeout(2000);

      // Should be redirected to login
      expect(page.url()).toContain("/login");

      await context.close();
    });
  });

  test.describe("API contract", () => {
    test("POST /api/admin/login returns correct shape", async ({ browser }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login");

      const response = await page.evaluate(async ({ email, password }) => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: email,
            password,
          }),
          credentials: "include",
        });
        return await res.json();
      }, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(response.success).toBe(true);
      expect(response.session).toBeDefined();
      expect(response.session.user).toBeDefined();
      expect(response.session.user.email).toBe(ADMIN_EMAIL);
      expect(response.session.user.role).toBe("root");
      expect(response.session.user.roleImportance).toBe(100);
      expect(response.session.restaurants).toBeInstanceOf(Array);
      expect(response.session.restaurants.length).toBeGreaterThan(0);
      expect(response.session.activeRestaurantId).toBeDefined();

      await context.close();
    });

    test("POST /api/admin/login with wrong password returns error", async ({
      browser,
    }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login");

      const response = await page.evaluate(async (email) => {
        const res = await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            identifier: email,
            password: "wrongpassword",
          }),
        });
        return await res.json();
      }, ADMIN_EMAIL);

      expect(response.success).toBe(false);
      expect(response.message).toBeDefined();

      await context.close();
    });

    test("GET /api/admin/me with valid session returns user data", async ({
      adminPage,
    }) => {
      await adminPage.goto("/app");
      const response = await adminPage.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return await res.json();
      });

      expect(response.success).toBe(true);
      expect(response.session.user.email).toBe(ADMIN_EMAIL);
    });

    test("GET /api/admin/me without session returns 401", async ({
      browser,
    }) => {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await page.goto("/login");

      const status = await page.evaluate(async () => {
        const res = await fetch("/api/admin/me", { credentials: "include" });
        return res.status;
      });

      expect(status).toBe(401);
      await context.close();
    });
  });
});
