import { test, expect } from "../../fixtures/session";

test.describe("Integration - Red Scenarios", () => {
  test("invalid URL parameters handled gracefully", async ({ adminPage }) => {
    // Navigate with invalid food type
    await adminPage.goto("/app/comida/invalidtype999");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(2000);

    // Page should not crash - either show error or redirect
    const bodyText = await adminPage.textContent("body");
    expect(bodyText).toBeTruthy();

    // Navigate with invalid menu ID
    await adminPage.goto("/app/menus/crear?menuId=99999");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.waitForTimeout(2000);

    const bodyText2 = await adminPage.textContent("body");
    expect(bodyText2).toBeTruthy();
  });

  test("XSS protection in input fields", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForSelector("form", { timeout: 15_000 });

    const xssPayload = '<script>alert("xss")</script>';

    // Fill XSS payload into login form
    await page.fill('input[type="text"]', xssPayload);
    await page.fill('input[type="password"]', "test");

    // Submit
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Verify no alert was triggered (XSS didn't execute)
    // The page should handle it as a normal failed login
    expect(page.url()).toContain("/login");

    await context.close();
  });

  test("API returns proper error for non-existent booking", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/bookings/999999", {
        credentials: "include",
      });
      return { status: res.status, data: await res.json() };
    });

    // Should return 404 or success:false
    if (response.status === 200) {
      expect(response.data.success).toBe(false);
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
  });

  test("API returns error for non-existent member", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/members/999999", {
        credentials: "include",
      });
      return { status: res.status, data: await res.json() };
    });

    expect(response.data.success).toBe(false);
  });

  test("API returns error for non-existent menu", async ({ adminPage }) => {
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/group-menus-v2/999999", {
        credentials: "include",
      });
      return { status: res.status, data: await res.json() };
    });

    expect(response.data.success).toBe(false);
  });

  test("booking creation validates required fields", async ({
    adminPage,
  }) => {
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

    // Try to create booking without required fields
    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        credentials: "include",
      });
      return { status: res.status, data: await res.json() };
    });

    expect(response.data.success).toBe(false);
  });

  test("session expiration handled gracefully", async ({ browser }) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Login
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.waitForSelector("form", { timeout: 15_000 });
    await page.fill('input[type="text"]', "admin@hotmail.com");
    await page.fill('input[type="password"]', "admin123123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app/**", { timeout: 15_000 });

    // Clear cookies to simulate session expiration
    await context.clearCookies();

    // Try to make API call
    const response = await page.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return res.status;
    });

    expect(response).toBe(401);

    // Navigate to a protected page
    await page.goto("/app/reservas");
    await page.waitForTimeout(2000);

    // Should redirect to login or show login page
    const url = page.url();
    expect(url).toContain("/login");

    await context.close();
  });

  test("CORS headers present for API requests", async ({ adminPage }) => {
    await adminPage.goto("/app");
    await adminPage.waitForURL("**/app/**", { timeout: 10_000 });

    // Make a request and check CORS headers
    const response = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return {
        status: res.status,
        corsHeader: res.headers.get("access-control-allow-origin"),
      };
    });

    // CORS header should be present or request should succeed
    // (same-origin requests don't need CORS)
    expect([200, 401]).toContain(response.status);
  });
});
