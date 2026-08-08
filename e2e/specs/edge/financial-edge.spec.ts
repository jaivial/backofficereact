import { test, expect } from "../../fixtures/session";

// Pantallas 15-18: Facturas, Estadisticas, Estado de Cuenta, Reportes.

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1800);
}

test.describe("@edge Facturas", () => {
  test("pagina renderiza tabs y filtros", async ({ adminPage }) => {
    await open(adminPage, "/app/facturas");
    await expect(adminPage.getByTestId("tab-resumen")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("tab-añadir")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId("invoice-filter-search-input")).toBeVisible({ timeout: 10_000 });
  });

  test("toggle de filtros de facturas", async ({ adminPage }) => {
    await open(adminPage, "/app/facturas");
    await adminPage.getByTestId("invoice-filters-toggle-btn").click();
    await adminPage.waitForTimeout(500);
    await adminPage.getByTestId("invoice-filters-toggle-btn").click();
    await adminPage.waitForTimeout(500);
    await expect(adminPage.getByTestId("tab-resumen")).toBeVisible();
  });
});

test.describe("@edge Estadisticas", () => {
  test("dashboard financiero muestra datos de ingresos", async ({ adminPage }) => {
    await open(adminPage, "/app/estadisticas");
    // El panel renderiza los datos de ingresos (contenido estable visible)
    await expect(adminPage.getByText("CONTROL FINANCIERO").first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText(/INGRESOS FACTURADOS/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Actualizar").first()).toBeVisible({ timeout: 10_000 });
  });

  test("filtros de estadisticas accesibles", async ({ adminPage }) => {
    await open(adminPage, "/app/estadisticas");
    await expect(adminPage.getByText("Filtros").first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Actualizar").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Estado de Cuenta", () => {
  test("formulario de estado de cuenta renderiza", async ({ adminPage }) => {
    await open(adminPage, "/app/estado-cuenta");
    await expect(adminPage.getByTestId("estado-cuenta-customer-select")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("estado-cuenta-load-customers-button")).toBeVisible();
    await expect(adminPage.getByTestId("estado-cuenta-generate-statement-button")).toBeVisible();
  });

  test("generar sin cliente esta deshabilitado (validacion)", async ({ adminPage }) => {
    await open(adminPage, "/app/estado-cuenta");
    const gen = adminPage.getByTestId("estado-cuenta-generate-statement-button");
    await gen.waitFor({ timeout: 15_000 });
    // Sin cliente seleccionado el botón está disabled: no se puede generar
    await expect(gen).toBeDisabled();
  });
});

test.describe("@edge Reportes", () => {
  test("seccion de IVA renderiza con periodo", async ({ adminPage }) => {
    await open(adminPage, "/app/reportes");
    await expect(adminPage.getByTestId("reportes-iva-section")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("reportes-iva-period-select")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId("reportes-generate-iva-button")).toBeVisible();
  });
});
