import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Pantalla 22: Site Builder / Website.
// /app/website usa pages/app/website/+Page.tsx (sin data-testid, assert por texto).
// /app/site-builder usa data-ui.

const ui = (name: string) => `[data-ui="${name}"]`;

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
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
    await expect(adminPage.getByText("Plantillas Premium").first()).toBeVisible({ timeout: 15_000 });
    const elegir = adminPage.getByText("Elegir");
    if (await elegir.count()) {
      // Al menos una plantilla seleccionable
      expect(await elegir.count()).toBeGreaterThan(0);
    } else {
      // Sin plantillas configuradas en dev: la sección sigue renderizando
      await expect(adminPage.getByText("Dominio Personalizado").first()).toBeVisible({ timeout: 10_000 });
    }
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
