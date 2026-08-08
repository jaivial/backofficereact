import { test, expect } from "../../fixtures/session";

// Pantalla 22: Site Builder / Website.
// /app/website usa pages/app/website/+Page.tsx (sin data-testid, assert por texto).
// /app/site-builder usa data-ui.

const ui = (name: string) => `[data-ui="${name}"]`;

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1800);
}

test.describe("@edge Site Builder", () => {
  test("editor instatic se monta (o muestra no disponible sin crash)", async ({ adminPage }) => {
    await open(adminPage, "/app/site-builder");
    await expect(adminPage.locator(ui("site-builder-instatic-frame")).or(adminPage.locator(ui("site-builder-unavailable"))).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("@edge Website", () => {
  test("website builder renderiza con plantillas", async ({ adminPage }) => {
    await open(adminPage, "/app/website");
    await expect(adminPage.getByText("Website Builder").first()).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.getByText("Plantillas Premium").first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText("Constructor con IA").first()).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.getByText("Dominio Personalizado").first()).toBeVisible({ timeout: 10_000 });
  });

  test("botones elegir plantilla presentes", async ({ adminPage }) => {
    await open(adminPage, "/app/website");
    const elegir = adminPage.getByText("Elegir").first();
    await expect(elegir).toBeVisible({ timeout: 15_000 });
    // Al menos una plantilla seleccionable
    expect(await adminPage.getByText("Elegir").count()).toBeGreaterThan(0);
  });

  test("estado de publicacion visible", async ({ adminPage }) => {
    await open(adminPage, "/app/website");
    await expect(adminPage.getByText("Publicado").or(adminPage.getByText("Borrador")).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("@edge Website Builder (ruta obsoleta)", () => {
  test("website-builder devuelve 404 controlado", async ({ adminPage }) => {
    // Página 404 fuera del shell de la app (no tiene topbar)
    await adminPage.goto("/app/website-builder", { waitUntil: "domcontentloaded" });
    await expect(adminPage.getByText("Pagina no encontrada").first()).toBeVisible({ timeout: 15_000 });
  });
});
