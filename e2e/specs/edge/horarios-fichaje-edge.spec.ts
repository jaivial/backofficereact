import { test, expect } from "../../fixtures/session";

// Pantallas 13 (Horarios) y 14 (Fichaje).

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1800);
}

test.describe("@edge Horarios", () => {
  test("calendario mensual renderiza con navegacion", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    await expect(adminPage.getByTestId("month-calendar")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("month-calendar-prev")).toBeVisible();
    await expect(adminPage.getByTestId("month-calendar-next")).toBeVisible();
  });

  test("navegar entre meses no rompe el calendario", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    await adminPage.getByTestId("month-calendar-next").click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage.getByTestId("month-calendar")).toBeVisible({ timeout: 10_000 });
    await adminPage.getByTestId("month-calendar-prev").click();
    await adminPage.waitForTimeout(800);
    await adminPage.getByTestId("month-calendar-prev").click();
    await adminPage.waitForTimeout(800);
    await expect(adminPage.getByTestId("month-calendar")).toBeVisible({ timeout: 10_000 });
  });

  test("seleccionar un dia del calendario", async ({ adminPage }) => {
    await open(adminPage, "/app/horarios");
    const day = adminPage.locator('[data-testid^="month-calendar-day-"]').filter({ hasText: /\d/ }).first();
    await day.click();
    await adminPage.waitForTimeout(1200);
    await expect(adminPage.locator('[data-ui="horarios-page"]')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Fichaje", () => {
  test("panel admin de fichaje renderiza con estado de conexion", async ({ adminPage }) => {
    await open(adminPage, "/app/fichaje");
    await expect(adminPage.getByTestId("fichaje-admin-section")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("fichaje-admin-connection")).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText("Miembros").first()).toBeVisible({ timeout: 10_000 });
  });

  test("select de fecha en panel admin funciona", async ({ adminPage }) => {
    await open(adminPage, "/app/fichaje");
    await expect(adminPage.getByTestId("fichaje-admin-date")).toBeVisible({ timeout: 15_000 });
    const dateText = await adminPage.getByTestId("fichaje-admin-date").innerText();
    expect(dateText).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
