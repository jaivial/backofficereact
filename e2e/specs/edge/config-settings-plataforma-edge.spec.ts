import { test, expect } from "../../fixtures/session";
import { waitForHydration } from "../../helpers/wait";

// Pantallas 19-21: Config (+booking), Settings, Plataforma, Comsit.
// Nota: estas páginas usan data-ui (no data-testid) para wrappers/paneles.

const ui = (name: string) => `[data-ui="${name}"]`;

async function open(page: import("@playwright/test").Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForHydration(page);
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
}

test.describe("@edge Config", () => {
  test("config renderiza secciones y tabs", async ({ adminPage }) => {
    await open(adminPage, "/app/config");
    await expect(adminPage.getByTestId("config-section")).toBeVisible({ timeout: 15_000 });
    for (const tab of ["restaurante", "contacto", "booking", "legal-pages", "ia"]) {
      await expect(adminPage.getByTestId(`tab-${tab}`)).toBeVisible({ timeout: 10_000 });
    }
  });

  test("config booking renderiza guia de instalacion y preview", async ({ adminPage }) => {
    await open(adminPage, "/app/config/booking");
    await expect(adminPage.locator(ui("booking-manager"))).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(ui("install-guide"))).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ui("widget-preview"))).toBeVisible({ timeout: 10_000 });
  });

  test("config restaurante renderiza paneles de horarios y limites", async ({ adminPage }) => {
    await open(adminPage, "/app/config");
    await adminPage.getByTestId("tab-restaurante").click();
    await expect(adminPage.locator(ui("config-restaurante-hours-panel"))).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ui("config-restaurante-limits-panel"))).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Settings", () => {
  test("settings renderiza paneles principales", async ({ adminPage }) => {
    await open(adminPage, "/app/settings");
    await expect(adminPage.locator(ui("settings-page"))).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(ui("integrations-panel"))).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ui("branding-panel"))).toBeVisible({ timeout: 10_000 });
  });

  test("campos de branding presentes", async ({ adminPage }) => {
    await open(adminPage, "/app/settings");
    await expect(adminPage.locator(ui("brandNameField"))).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(ui("logoUrlField"))).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Plataforma", () => {
  test("plataforma renderiza tabs y dashboard", async ({ adminPage }) => {
    await open(adminPage, "/app/plataforma");
    await expect(adminPage.locator(ui("platform-page"))).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(ui("platform-tab-dashboard"))).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ui("platform-dashboard"))).toBeVisible({ timeout: 10_000 });
  });

  test("navegar a tab de restaurantes", async ({ adminPage }) => {
    await open(adminPage, "/app/plataforma");
    await adminPage.locator(ui("platform-tab-restaurants")).click();
    await expect(adminPage.locator(ui("restaurants-tab"))).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(ui("platform-page"))).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("@edge Comsit", () => {
  test("comsit carga como config de reservas", async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("response", (r) => {
      if (r.status() >= 500 && !r.url().includes("/vite")) errors.push(`${r.url()} -> ${r.status()}`);
    });
    await open(adminPage, "/app/comsit");
    await expect(adminPage.getByTestId("config-section").or(adminPage.locator(ui("reservas-section"))).first()).toBeVisible({ timeout: 15_000 });
    expect(errors).toEqual([]);
  });
});
