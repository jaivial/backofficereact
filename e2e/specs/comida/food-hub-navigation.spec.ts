import { test, expect } from "@playwright/test";

const categories = [
  { label: "Platos", type: "platos" },
  { label: "Bebidas", type: "bebidas" },
  { label: "Cafes", type: "cafes" },
  { label: "Vinos", type: "vinos" },
];

async function login(page: import("@playwright/test").Page) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async ({ email, password }) => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
      credentials: "include",
    });
    return res.json();
  }, { email, password });

  expect(result.success).toBe(true);
}

test("keeps target content visible after client-side navigation", async ({ page }) => {
  await login(page);
  await page.goto("/app/comida", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Abrir Platos" }).click();

  await expect(page).toHaveURL(/\/app\/comida\/platos$/);
  await expect(page.locator('[data-role="food-type-page"]')).toHaveCSS("opacity", "1");
});

for (const category of categories) {
  test(`opens ${category.label} with one click before hydration`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await login(page);
    await page.route("**/pages/app/comida/+Page.tsx*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.continue();
    });
    await page.goto("/app/comida", { waitUntil: "domcontentloaded" });

    await page.locator('[data-ui="food-hub-card"]', { hasText: category.label }).click();

    await expect(page).toHaveURL(new RegExp(`/app/comida/${category.type}$`), { timeout: 1_000 });
    await expect(page.locator('[data-role="food-type-page"]')).toHaveCSS("opacity", "1");
    expect(errors).toEqual([]);
  });
}
