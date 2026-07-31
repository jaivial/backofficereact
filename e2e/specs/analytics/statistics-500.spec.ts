import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || process.env.BOOTSTRAP_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || process.env.BOOTSTRAP_ADMIN_PASSWORD || "";

test.describe("Statistics page production smoke", () => {
  test("loads /app/estadisticas without an SSR or API 500", async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "Backend admin credentials are not configured");

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const login = await page.evaluate(async ({ email, password }) => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: email, password }),
      });
      return { status: response.status, body: await response.json() };
    }, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    expect(login.status, JSON.stringify(login.body)).toBeLessThan(400);
    expect(login.body.success, JSON.stringify(login.body)).toBe(true);

    const session = await page.evaluate(async () => {
      const response = await fetch("/api/admin/me", { credentials: "include" });
      return { status: response.status, body: await response.json() };
    });
    const user = session.body?.session?.user;
    console.log(`[statistics-e2e] session role=${user?.role ?? "<none>"} importance=${user?.roleImportance ?? "<none>"} sections=${(user?.sectionAccess ?? []).join(",")}`);
    expect(session.status, JSON.stringify(session.body)).toBe(200);
    expect(session.body.success, JSON.stringify(session.body)).toBe(true);

    const analyticsApi = await page.evaluate(async () => {
      const response = await fetch("/api/admin/analytics/overview?from=2026-07-01&to=2026-07-30&granularity=day&compare=previous", {
        credentials: "include",
      });
      return { status: response.status, body: await response.text() };
    });
    const analyticsBody = analyticsApi.status >= 400 ? analyticsApi.body.slice(0, 1000) : "<ok>";
    console.log(`[statistics-e2e] analytics-api status=${analyticsApi.status} body=${analyticsBody}`);

    const serverErrors: string[] = [];
    page.on("response", async (response) => {
      if (response.status() < 500) return;
      let body = "";
      try {
        body = (await response.text()).slice(0, 1000);
      } catch {
        body = "<unreadable response body>";
      }
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}\n${body}`);
    });

    const response = await page.goto("/app/estadisticas", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const status = response?.status() ?? 0;

    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(500);

    expect(status, serverErrors.join("\n\n")).toBeGreaterThanOrEqual(200);
    expect(status, serverErrors.join("\n\n")).toBeLessThan(500);
    console.log(`[statistics-e2e] response=${status} finalUrl=${page.url()}`);
    expect(page.url()).toContain("/app/estadisticas");
    await expect(page.getByRole("heading", { name: "Estadísticas" })).toBeVisible();

    expect(serverErrors, serverErrors.join("\n\n")).toEqual([]);
  });
});
