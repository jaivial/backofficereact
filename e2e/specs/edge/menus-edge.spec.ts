import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";
import { pickMenuTypeWithItems } from "../../helpers/api";

// Pantalla 8: Menus (paneles tipo -> tarjetas -> crear).
// El tipo con tarjetas se elige dinámicamente desde la API (sin depender de datos fijos).

async function openMenus(page: import("@playwright/test").Page) {
  await page.goto("/app/menus", { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await expect(page.getByTestId("menus-page-section")).toBeVisible({ timeout: 25_000 });
  await expect(page.getByTestId("menu-type-panel-closed_conventional")).toBeVisible({ timeout: 20_000 });
}

test.describe("@edge Menus", () => {
  test("paneles de tipo de menu visibles con contadores", async ({ adminPage }) => {
    await openMenus(adminPage);
    for (const type of ["closed_conventional", "closed_group", "a_la_carte", "a_la_carte_group", "special"]) {
      await expect(adminPage.getByTestId(`menu-type-panel-${type}`)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("elegir tipo muestra tarjetas y volver funciona", async ({ adminPage }) => {
    await openMenus(adminPage);
    const { type, hasItems } = await pickMenuTypeWithItems(adminPage);

    await adminPage.getByTestId(`menu-type-panel-${type}`).click();
    if (hasItems) {
      await expect(adminPage.locator('[data-testid^="menu-summary-"]').first()).toBeVisible({ timeout: 15_000 });
      const cardCount = await adminPage.locator('[data-testid^="menu-summary-"]').count();
      expect(cardCount).toBeGreaterThan(0);
    } else {
      // Sin menús en dev: el listado queda vacío pero sin crash
      await expect(adminPage.getByTestId("menus-page-section")).toBeVisible({ timeout: 10_000 });
    }

    await adminPage.getByTestId("menus-page-back-button").click();
    await expect(adminPage.getByTestId("menu-type-panel-closed_conventional")).toBeVisible({ timeout: 10_000 });
  });

  test("busqueda por titulo filtra tarjetas", async ({ adminPage }) => {
    await openMenus(adminPage);
    const { type, hasItems } = await pickMenuTypeWithItems(adminPage);
    if (!hasItems) {
      // Sin datos en dev: solo verificamos que la sección y el buscador existen
      await expect(adminPage.getByTestId("menus-page-search-input")).toBeVisible({ timeout: 10_000 });
      return;
    }

    await adminPage.getByTestId(`menu-type-panel-${type}`).click();
    await expect(adminPage.locator('[data-testid^="menu-summary-"]').first()).toBeVisible({ timeout: 15_000 });

    const before = await adminPage.locator('[data-testid^="menu-summary-"]').count();
    await adminPage.getByTestId("menus-page-search-input").fill("zz-titulo-inexistente-zz");
    await adminPage.keyboard.press("Enter");
    await expect(adminPage.locator('[data-testid^="menu-summary-"]')).toHaveCount(0, { timeout: 10_000 });

    // Limpiar filtros restaura el listado (resetea a "Todos los tipos")
    await adminPage.getByTestId("menus-page-clear-filters-button").click();
    await expect(adminPage.locator('[data-testid^="menu-summary-"]').first()).toBeVisible({ timeout: 10_000 });
    const restored = await adminPage.locator('[data-testid^="menu-summary-"]').count();
    expect(restored).toBeGreaterThan(0);
  });

  test("crear menu abre modal de plantillas y se cierra", async ({ adminPage }) => {
    await openMenus(adminPage);
    await adminPage.getByTestId("menus-page-create-button").click();
    await expect(adminPage.getByText(/Elige una base para empezar/i).first()).toBeVisible({ timeout: 10_000 });
    await adminPage.locator('[data-ui="modal-close"]').click();
    await expect(adminPage.getByText(/Elige una base para empezar/i).first()).toHaveCount(0, { timeout: 10_000 });
  });

  test("el boton de limpiar filtros no tiene typo", async ({ adminPage }) => {
    await openMenus(adminPage);
    const { type } = await pickMenuTypeWithItems(adminPage);
    await adminPage.getByTestId(`menu-type-panel-${type}`).click();
    await expect(adminPage.getByTestId("menus-page-search-input")).toBeVisible({ timeout: 15_000 });
    // Activar un filtro para que el botón de limpiar sea visible
    await adminPage.getByTestId("menus-page-search-input").fill("zz");
    await adminPage.keyboard.press("Enter");
    const clear = adminPage.getByTestId("menus-page-clear-filters-button");
    await clear.waitFor({ state: "visible", timeout: 10_000 });
    const text = await clear.innerText();
    expect(text.trim().toLowerCase()).not.toBe("limipiar filtros");
  });
});
