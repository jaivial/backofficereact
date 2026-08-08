import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Pantalla 12: Miembros.

async function openMiembros(page: import("@playwright/test").Page, url = "/app/miembros") {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
}

test.describe("@edge Miembros", () => {
  test("lista de miembros renderiza con contador", async ({ adminPage }) => {
    await openMiembros(adminPage);
    await expect(adminPage.getByTestId("member-count")).toBeVisible({ timeout: 15_000 });
    const text = await adminPage.getByTestId("member-count").innerText();
    expect(text).toMatch(/\d+ miembros/);
  });

  test("anadir miembro abre modal con formulario y se cierra", async ({ adminPage }) => {
    await openMiembros(adminPage);
    await adminPage.getByTestId("add-member-button").click();
    await expect(adminPage.getByText("Guardar miembro").first()).toBeVisible({ timeout: 10_000 });
    await adminPage.locator('[data-ui="modal-close"]').click();
    await expect(adminPage.getByText("Guardar miembro").first()).toHaveCount(0, { timeout: 10_000 });
  });

  test("tab roles carga catalogo", async ({ adminPage }) => {
    await openMiembros(adminPage);
    await adminPage.getByTestId("tab-roles").click();
    await adminPage.waitForURL(/\/app\/miembros\/roles/, { timeout: 15_000 });
    await expect(adminPage.getByText(/roles y jerarqu/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText(/\d+ roles/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("click en miembro abre su detalle", async ({ adminPage }) => {
    await openMiembros(adminPage);
    const card = adminPage.locator('[role="link"]').first();
    await card.click();
    await adminPage.waitForURL(/\/app\/miembros\/\d+/, { timeout: 15_000 });
    await adminPage.getByTestId("topbar").waitFor({ timeout: 15_000 });
  });

  test("detalle de miembro inexistente sin 500", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await openMiembros(adminPage, "/app/miembros/999999999");
    expect(errors).toEqual([]);
  });
});
