import { test, expect } from "../../fixtures/session";
import { pickBookingDates } from "../../helpers/api";
import { waitForHydration } from "../../helpers/wait";

// Pantalla 7: Reservas (lista + tabs estado + anadir/config/tables).
// Las fechas se eligen dinámicamente desde la API para no depender de datos fijos.

async function openReservas(page: import("@playwright/test").Page, date: string) {
  await page.goto(`/app/reservas?date=${date}`, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await expect(page.getByTestId("reservas-section")).toBeVisible({ timeout: 25_000 });
}

test.describe("@edge Reservas", () => {
  test("lista con reservas muestra mesas", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]').first()).toBeVisible({ timeout: 15_000 });
    const mesas = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(mesas).toBeGreaterThan(0);
  });

  test("cambio de estado Activas/Canceladas/Modificadas no rompe la lista", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    // La tab activa está disabled; rotamos por estados no activos.
    for (const state of ["Canceladas", "Modificadas", "Activas"]) {
      const tab = adminPage.getByTestId(`tab-${state.toLowerCase()}`);
      if (await tab.isEnabled().catch(() => false)) {
        await tab.click();
        // La tab clickeada pasa a activa (aria-selected)
        await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 10_000 });
      }
      await expect(adminPage.getByTestId("reservas-section")).toBeVisible({ timeout: 10_000 });
    }
  });

  test("abrir y cerrar detalle de reserva via acciones", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]').first()).toBeVisible({ timeout: 15_000 });
    await adminPage.locator('[data-ui="dropdown-trigger"]').last().click();
    await adminPage.getByRole("menuitem", { name: "Reserva completa" }).click();
    await expect(adminPage.getByTestId("reservas-page-details-close-btn")).toBeVisible({ timeout: 10_000 });
    await adminPage.getByTestId("reservas-page-details-close-btn").click();
    await expect(adminPage.getByTestId("reservas-page-details-close-btn")).toHaveCount(0, { timeout: 10_000 });
  });

  test("busqueda por nombre filtra la lista", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]').first()).toBeVisible({ timeout: 15_000 });
    const before = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();

    const search = adminPage.getByTestId("reservas-page-search-input");
    await search.fill("zz-noexiste-zz");
    await adminPage.getByTestId("reservas-page-search-button").click();
    // La búsqueda sin resultados vacía la lista (sin mesas)
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]')).toHaveCount(0, { timeout: 10_000 });

    // Limpiar y volver a ver datos
    await search.fill("");
    await adminPage.getByTestId("reservas-page-search-button").click();
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]').first()).toBeVisible({ timeout: 10_000 });
    const after = await adminPage.locator('[data-testid^="reservas-page-mesa-"]').count();
    expect(after).toBe(before);
  });

  test("navegacion entre tabs externos", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    await adminPage.getByTestId("tab-anadir").click();
    await adminPage.waitForURL(/\/app\/reservas\/anadir/, { timeout: 15_000 });
    await adminPage.getByTestId("tab-config").click();
    await adminPage.waitForURL(/\/app\/reservas\/config/, { timeout: 15_000 });
    await adminPage.getByTestId("tab-tables").click();
    await adminPage.waitForURL(/\/app\/reservas\/tables/, { timeout: 15_000 });
  });

  test("fecha sin reservas muestra lista vacia sin crash", async ({ adminPage }) => {
    const { empty } = await pickBookingDates(adminPage);
    await openReservas(adminPage, empty);
    await expect(adminPage.locator('[data-testid^="reservas-page-mesa-"]')).toHaveCount(0, { timeout: 10_000 });
  });

  test("controles de filtros presentes y funcionales", async ({ adminPage }) => {
    const { withBookings } = await pickBookingDates(adminPage);
    await openReservas(adminPage, withBookings);
    await expect(adminPage.getByTestId("reservas-page-search-input")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId("reservas-page-search-button")).toBeVisible();
    await expect(adminPage.locator('[data-slot="reservas-page-filter-selects"]')).toBeVisible({ timeout: 10_000 });
  });

  test("config diaria: incrementar y decrementar limite", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas/config", { waitUntil: "domcontentloaded" });
    await waitForHydration(adminPage);
    const input = adminPage.locator('[data-ui="limit-input"]');
    await input.waitFor({ timeout: 20_000 });
    const initial = parseInt((await input.inputValue()) || "0", 10);

    await adminPage.locator('[data-ui="increment-btn"]').click();
    await expect(input).toHaveValue(String(initial + 1), { timeout: 10_000 });

    await adminPage.locator('[data-ui="decrement-btn"]').click();
    await expect(input).toHaveValue(String(initial), { timeout: 10_000 });
  });
});
