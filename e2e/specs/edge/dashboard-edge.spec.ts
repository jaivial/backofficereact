import { test, expect } from "../../fixtures/session";

// Pantalla 6: Dashboard. SSR con ?date=. Interacción real de navegación.

async function openDash(page: import("@playwright/test").Page, url = "/app/dashboard") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1000);
}

test.describe("@edge Dashboard", () => {
  test("sin date renderiza KPIs de reservas y facturas", async ({ adminPage }) => {
    await openDash(adminPage);
    await expect(adminPage.getByTestId("dashboard-reservas-section")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("dashboard-facturas-section")).toBeVisible({ timeout: 15_000 });

    // Los KPIs muestran valores numéricos dentro del section de reservas
    const reservasText = await adminPage.getByTestId("dashboard-reservas-section").innerText();
    expect(reservasText).toMatch(/\d/);
    for (const label of ["Reservas", "Confirmadas", "Pendientes", "Comensales"]) {
      expect(reservasText).toContain(label);
    }
  });

  test("date historica valida renderiza KPIs", async ({ adminPage }) => {
    await openDash(adminPage, "/app/dashboard?date=2026-01-15");
    await expect(adminPage.getByTestId("dashboard-reservas-section")).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByTestId("dashboard-facturas-section")).toBeVisible({ timeout: 15_000 });
  });

  test("date futura valida renderiza KPIs", async ({ adminPage }) => {
    await openDash(adminPage, "/app/dashboard?date=2030-12-31");
    await expect(adminPage.getByTestId("dashboard-reservas-section")).toBeVisible({ timeout: 15_000 });
  });

  test("date invalida no produce 500 ni crash", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await openDash(adminPage, "/app/dashboard?date=abc");
    // Sin 500 y el shell sigue presente
    expect(errors).toEqual([]);
    await expect(adminPage.getByTestId("topbar")).toBeVisible({ timeout: 10_000 });
  });
});
