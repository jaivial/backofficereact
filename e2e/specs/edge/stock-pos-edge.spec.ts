import { test, expect } from "../../fixtures/session";

// Pantallas 10 (Stock) y 11 (POS).

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1800);
}

test.describe("@edge Stock", () => {
  test("pagina de stock renderiza resumen", async ({ adminPage }) => {
    await open(adminPage, "/app/stock");
    await expect(adminPage.locator('[data-ui="stock-page"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-ui="stock-summary"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test("botones gestionar almacenes y nuevo item presentes", async ({ adminPage }) => {
    await open(adminPage, "/app/stock");
    await expect(adminPage.getByTestId("stock-manage-warehouses")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("stock-new-item")).toBeVisible();
  });

  test("nuevo item abre formulario", async ({ adminPage }) => {
    await open(adminPage, "/app/stock");
    await adminPage.getByTestId("stock-new-item").click();
    await adminPage.waitForTimeout(800);
    // El formulario o modal de nuevo ítem se abre (input de nombre/cantidad)
    const anyForm = await adminPage.locator('[data-ui="stock-item-form"], input, [role="dialog"]').count();
    expect(anyForm).toBeGreaterThan(0);
  });
});

test.describe("@edge POS", () => {
  test("pagina TPV renderiza cabecera y modo", async ({ adminPage }) => {
    await open(adminPage, "/app/pos");
    await expect(adminPage.locator('[data-ui="pos-page"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-ui="pos-title"]')).toHaveText(/TPV/);
  });

  test("seccion catalogo muestra productos TPV", async ({ adminPage }) => {
    await open(adminPage, "/app/pos");
    await adminPage.getByTestId("pos-section-menu").click();
    await adminPage.getByTestId("pos-section-catalog").click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage.locator('[data-ui="pos-catalog-products"]')).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator('[data-ui="pos-import-preview"]')).toBeVisible();
  });

  test("secciones stock y reports cargan sin error", async ({ adminPage }) => {
    await open(adminPage, "/app/pos");
    await adminPage.getByTestId("pos-section-menu").click();
    await adminPage.getByTestId("pos-section-stock").click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage.locator('[data-ui="pos-readiness"]').or(adminPage.locator('[data-ui="pos-mapping"]')).first()).toBeVisible({ timeout: 15_000 });
    await adminPage.getByTestId("pos-section-menu").click();
    await adminPage.getByTestId("pos-section-reports").click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage.locator('[data-ui="pos-sales-report"]').or(adminPage.locator('[data-ui="pos-covers-report"]')).first()).toBeVisible({ timeout: 15_000 });
  });
});
