import { expect, test } from "@playwright/test";

// The site-builder page embeds instatic's editor via an iframe on editor-dev.
// Verify the iframe exists, points at the editor origin, and the instatic editor
// shell actually loads inside it (authenticated — no login form).
test.describe("Site builder instatic editor", () => {
  test("renders instatic editor iframe, authenticated", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="text"]', "admin@villacarmen.com");
    await page.fill('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app/**", { timeout: 15_000 });

    await page.goto("/app/site-builder", { waitUntil: "networkidle" });

    const me = await page.evaluate(async () => (await fetch("/api/admin/me")).json());
    const activeRestaurantId = me?.session?.activeRestaurantId;
    expect(activeRestaurantId).toBeTruthy();

    const frameEl = page.locator('[data-ui="site-builder-instatic-frame"]');
    await expect(frameEl).toBeVisible();
    const src = await frameEl.getAttribute("src");
    expect(src).toContain("editor-dev.menustudioai.com/admin");
    expect(new URL(src ?? "").searchParams.get("rid")).toBe(String(activeRestaurantId));
    // Editor shell loads inside the frame and is authenticated (mounts #app, no login form).
    const frame = page.frameLocator('[data-ui="site-builder-instatic-frame"]');
    await expect(frame.locator("#app")).toBeAttached({ timeout: 25_000 });
    await expect(frame.locator("form.login-skeleton__form")).toHaveCount(0);

    await ctx.close();
  });
});
