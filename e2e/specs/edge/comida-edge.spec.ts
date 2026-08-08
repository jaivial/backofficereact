import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Pantalla 9: Comida (hub + listas por tipo).

async function openComida(page: import("@playwright/test").Page, url = "/app/comida") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  // Espera web-first: hub o grid según la ruta
  await expect(page.locator('[data-ui="food-hub-section"]').or(page.locator('[data-ui="food-list-grid"]')).first()).toBeVisible({ timeout: 25_000 });
}

test.describe("@edge Comida", () => {
  test("hub muestra categorias de la carta", async ({ adminPage }) => {
    await openComida(adminPage);
    await expect(adminPage.locator('[data-ui="food-hub-section"]')).toBeVisible({ timeout: 15_000 });
    for (const label of ["Platos", "Bebidas", "Cafes", "Vinos"]) {
      await expect(adminPage.locator(`[data-ui="food-hub-card"]`, { hasText: label }).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("lista de platos renderiza con grid y paginacion", async ({ adminPage }) => {
    await openComida(adminPage, "/app/comida/platos");
    await expect(adminPage.locator('[data-ui="food-list-grid"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-ui="food-list-pager"]')).toBeVisible({ timeout: 10_000 });
    const items = await adminPage.locator('[data-ui="food-list-grid"] > *').count();
    expect(items).toBeGreaterThan(0);
  });

  test("paginacion siguiente y anterior", async ({ adminPage }) => {
    await openComida(adminPage, "/app/comida/platos");
    const next = adminPage.locator('[data-role="food-list-pager-next"]');
    await next.waitFor({ timeout: 15_000 });
    const enabled = await next.isEnabled();
    if (enabled) {
      await next.click();
      const prev = adminPage.locator('[data-role="food-list-pager-prev"]');
      await expect(prev).toBeEnabled({ timeout: 10_000 });
      await prev.click();
      await expect(adminPage.locator('[data-ui="food-list-grid"]')).toBeVisible();
    }
  });

  test("lista de vinos renderiza", async ({ adminPage }) => {
    await openComida(adminPage, "/app/comida/vinos");
    await expect(adminPage.locator('[data-ui="food-list-grid"]')).toBeVisible({ timeout: 15_000 });
    const items = await adminPage.locator('[data-ui="food-list-grid"] > *').count();
    expect(items).toBeGreaterThan(0);
  });

  test("tipo invalido muestra error sin 500", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await openComida(adminPage, "/app/comida/zz-noexiste");
    await expect(adminPage.getByText("Tipo de comida invalido").first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});
