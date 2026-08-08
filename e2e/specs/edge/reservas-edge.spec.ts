import { test, expect } from "../../fixtures/session";

// Pantalla 7: Reservas (lista + tabs estado + anadir/config/tables).

const DATE_WITH_BOOKINGS = "2026-08-01";
const DATE_EMPTY = "2026-08-07";

async function openReservas(page: import("@playwright/test").Page, date = DATE_WITH_BOOKINGS) {
  await page.goto(`/app/reservas?date=${date}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
}

test.describe("@edge Reservas", () => {
  test("lista con reservas muestra mesas", async ({ adminPage }) => {
    await openReservas(adminPage);
    await expect(adminPage.getByTestId("reservas-section")).toBeVisible({ timeout: 15_000 });
    const mesas = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(mesas).toBeGreaterThan(0);
  });

  test("cambio de estado Activas/Canceladas/Modificadas no rompe la lista", async ({ adminPage }) => {
    await openReservas(adminPage);
    // La tab activa está disabled; rotamos por estados no activos.
    for (const state of ["Canceladas", "Modificadas", "Activas"]) {
      const tab = adminPage.getByTestId(`tab-${state.toLowerCase()}`);
      if (await tab.isEnabled().catch(() => false)) {
        await tab.click();
        await adminPage.waitForTimeout(800);
      }
      await expect(adminPage.getByTestId("reservas-section")).toBeVisible({ timeout: 10_000 });
    }
  });

  test("abrir y cerrar detalle de reserva via acciones", async ({ adminPage }) => {
    await openReservas(adminPage);
    const actions = adminPage.locator('[data-ui="dropdown-trigger"]').last();
    await actions.click();
    await adminPage.getByRole("menuitem", { name: "Reserva completa" }).click();
    await expect(adminPage.getByTestId("reservas-page-details-close-btn")).toBeVisible({ timeout: 10_000 });
    await adminPage.getByTestId("reservas-page-details-close-btn").click();
    await expect(adminPage.getByTestId("reservas-page-details-close-btn")).toHaveCount(0, { timeout: 10_000 });
  });

  test("busqueda por nombre filtra la lista", async ({ adminPage }) => {
    await openReservas(adminPage);
    const search = adminPage.getByTestId("reservas-page-search-input");
    await search.fill("zz-noexiste-zz");
    await adminPage.getByTestId("reservas-page-search-button").click();
    await adminPage.waitForTimeout(1000);
    const mesas = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(mesas).toBe(0);
    // Limpiar y volver a ver datos
    await search.fill("");
    await adminPage.getByTestId("reservas-page-search-button").click();
    await adminPage.waitForTimeout(1000);
    const mesas2 = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(mesas2).toBeGreaterThan(0);
  });

  test("navegacion entre tabs externos", async ({ adminPage }) => {
    await openReservas(adminPage);
    await adminPage.getByTestId("tab-anadir").click();
    await adminPage.waitForURL(/\/app\/reservas\/anadir/, { timeout: 15_000 });
    await adminPage.getByTestId("tab-config").click();
    await adminPage.waitForURL(/\/app\/reservas\/config/, { timeout: 15_000 });
    await adminPage.getByTestId("tab-tables").click();
    await adminPage.waitForURL(/\/app\/reservas\/tables/, { timeout: 15_000 });
  });

  test("fecha sin reservas muestra lista vacia sin crash", async ({ adminPage }) => {
    await openReservas(adminPage, DATE_EMPTY);
    await expect(adminPage.getByTestId("reservas-section")).toBeVisible({ timeout: 15_000 });
    const mesas = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(mesas).toBe(0);
  });

  test("controles de filtros presentes y funcionales", async ({ adminPage }) => {
    await openReservas(adminPage);
    // Controles del panel de filtros/búsqueda
    await expect(adminPage.getByTestId("reservas-page-search-input")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId("reservas-page-search-button")).toBeVisible();
    await expect(adminPage.locator('[data-slot="reservas-page-filter-selects"]')).toBeVisible({ timeout: 10_000 });
  });

  test("config diaria: incrementar y decrementar limite", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config", { waitUntil: "domcontentloaded" });
    await adminPage.getByTestId("topbar").waitFor({ timeout: 20_000 });
    await adminPage.waitForTimeout(1500);

    const input = adminPage.locator('[data-ui="limit-input"]');
    await input.waitFor({ timeout: 15_000 });
    const initial = parseInt((await input.inputValue()) || "0", 10);

    await adminPage.locator('[data-ui="increment-btn"]').click();
    await adminPage.waitForTimeout(800);
    const afterInc = parseInt((await input.inputValue()) || "0", 10);
    expect(afterInc).toBe(initial + 1);

    await adminPage.locator('[data-ui="decrement-btn"]').click();
    await adminPage.waitForTimeout(800);
    const afterDec = parseInt((await input.inputValue()) || "0", 10);
    expect(afterDec).toBe(initial);
  });
});
