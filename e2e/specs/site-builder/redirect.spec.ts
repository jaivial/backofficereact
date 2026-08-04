import { expect, test } from "@playwright/test";

// Regression: /app/site-builder used to redirect to /app/reservas because the
// path mapped to a "site-builder" section that the backend never grants (it
// grants "website"). Assert an admin lands on site-builder and stays there.
test.describe("Site builder access", () => {
  test("admin reaches /app/site-builder without redirect to reservas", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login", { waitUntil: "networkidle" });
    await page.fill('input[type="text"]', "admin@villacarmen.com");
    await page.fill('input[type="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app/**", { timeout: 15_000 });

    await page.goto("/app/site-builder", { waitUntil: "networkidle" });

    expect(page.url()).toContain("/app/site-builder");
    expect(page.url()).not.toContain("/app/reservas");

    await context.close();
  });
});
