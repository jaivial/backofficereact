import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Pantallas 13 (Horarios) y 14 (Fichaje).

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  // Espera web-first del contenido principal
  await expect(
    page.getByTestId("month-calendar").or(page.getByTestId("fichaje-admin-section")).first()
  ).toBeVisible({ timeout: 25_000 });
}

test.describe("@edge Horarios", () => {
  test("calendario mensual renderiza con navegacion", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    await expect(adminPage.getByTestId("month-calendar-prev")).toBeVisible();
    await expect(adminPage.getByTestId("month-calendar-next")).toBeVisible();
  });

  test("navegar entre meses no rompe el calendario", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    await adminPage.getByTestId("month-calendar-next").click();
    await expect(adminPage.getByTestId("month-calendar")).toBeVisible({ timeout: 10_000 });
    await adminPage.getByTestId("month-calendar-prev").click();
    await adminPage.getByTestId("month-calendar-prev").click();
    await expect(adminPage.getByTestId("month-calendar")).toBeVisible({ timeout: 10_000 });
  });

  test("seleccionar un dia del calendario", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    const day = adminPage.locator('[data-testid^="month-calendar-day-"]').filter({ hasText: /\d/ }).first();
    await day.click();
    await expect(adminPage.locator('[data-ui="horarios-page"]')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Fichaje", () => {
  test("panel admin de fichaje renderiza con estado de conexion", async ({ adminPage }) => {
    await open(adminPage, "/app/fichaje");
    await expect(adminPage.getByTestId("fichaje-admin-section")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("fichaje-admin-work-panel")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText("Miembros").first()).toBeVisible({ timeout: 10_000 });
  });

  test("select de fecha en panel admin funciona", async ({ adminPage }) => {
    await open(adminPage, "/app/fichaje");
    await expect(adminPage.getByTestId("fichaje-admin-actions")).toBeVisible({ timeout: 15_000 });
    const actionsText = await adminPage.getByTestId("fichaje-admin-actions").innerText();
    expect(actionsText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});
