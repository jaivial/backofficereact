import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Sub-rutas: comida detalle, facturas recurrentes, mi-horario, mapa de mesas.

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
}

test.describe("@edge Comida detalle", () => {
  test("abrir detalle desde tarjeta Editar", async ({ adminPage }) => {
    await open(adminPage, "/app/comida/platos");
    await adminPage.locator('button[aria-label^="Editar "]').first().click();
    await adminPage.waitForURL(/\/app\/comida\/platos\/\d+/, { timeout: 15_000 });
    await adminPage.getByTestId("topbar").waitFor({ timeout: 15_000 });
    await expect(adminPage.getByTestId("food-detail-topbar").or(adminPage.locator('[data-ui="food-detail-topbar"]')).first()).toBeVisible({ timeout: 15_000 });
  });

  test("detalle de plato inexistente muestra estado vacio sin 500", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await open(adminPage, "/app/comida/platos/1");
    await expect(adminPage.getByTestId("food-detail-empty-panel").or(adminPage.getByText("Elemento no disponible").first())).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe("@edge Facturas recurrentes", () => {
  test("pagina renderiza con stats y boton nueva", async ({ adminPage }) => {
    await open(adminPage, "/app/facturas/recurrentes");
    await expect(adminPage.getByTestId("facturas-recurrentes-page")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("facturas-recurrentes-nueva-btn")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByTestId("facturas-recurrentes-total-stat")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Mi horario", () => {
  test("pagina mi-horario renderiza sin crash", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await open(adminPage, "/app/miembros/mi-horario");
    await expect(adminPage.getByText("Mi Horario").first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});

test.describe("@edge Mapa de mesas", () => {
  test("mapa renderiza nodos de mesa", async ({ adminPage }) => {
    // Página immersive: no tiene topbar; usa data-ui
    await adminPage.goto("/app/reservas/tables", { waitUntil: "domcontentloaded" });
    await waitForHydration(adminPage);
    await expect(adminPage.locator('[data-ui="table-map-page"]')).toBeVisible({ timeout: 20_000 });
    // Los nodos cargan tras el fetch de mesas: esperar el primero
    await expect(adminPage.locator('[data-ui="table-node"]').first()).toBeVisible({ timeout: 15_000 });
    const nodes = await adminPage.locator('[data-ui="table-node"]').count();
    expect(nodes).toBeGreaterThan(0);
    await expect(adminPage.locator('[data-ui="add-table-top-btn"]')).toBeVisible({ timeout: 10_000 });
  });
});
