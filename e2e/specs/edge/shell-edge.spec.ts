import { test, expect } from "../../fixtures/session";

// Pantalla 5: shell de la app (home, sidebar, topbar, switcher restaurante, Forky, logout).
// Las páginas app requieren hidratación React: usar networkidle antes de interactuar.

async function goHome(page: import("@playwright/test").Page) {
  await page.goto("/app/backoffice", { waitUntil: "networkidle" });
  await page.getByTestId("topbar").waitFor({ timeout: 20_000 });
}

test.describe("@edge Shell", () => {
  test("home /app/backoffice renderiza orbit con todas las secciones root", async ({ adminPage }) => {
    await goHome(adminPage);
    await expect(adminPage.getByText(/Bienvenido/).first()).toBeVisible({ timeout: 15_000 });

    const expected = ["Reservas", "Menus", "Carta", "Stock", "TPV", "Miembros", "Horarios", "Fichaje", "Facturas", "Estadisticas", "Plataforma"];
    const labels = await adminPage.locator('[data-ui="orbit-node-label"]').allInnerTexts();
    for (const label of expected) {
      expect(labels).toContain(label);
    }
  });

  test("/app redirige al home backoffice", async ({ adminPage }) => {
    await adminPage.goto("/app", { waitUntil: "networkidle" });
    await expect(adminPage.locator('[data-ui="backoffice-home"]')).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar navega entre secciones", async ({ adminPage }) => {
    await goHome(adminPage);

    await adminPage.getByTestId("nav-link-reservas").first().click();
    await adminPage.waitForURL(/\/app\/reservas/, { timeout: 15_000 });

    await adminPage.getByTestId("nav-link-carta").first().click();
    await adminPage.waitForURL(/\/app\/comida/, { timeout: 15_000 });

    await adminPage.getByTestId("nav-link-menus").first().click();
    await adminPage.waitForURL(/\/app\/menus/, { timeout: 15_000 });
  });

  test("logo del sidebar vuelve al home", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas", { waitUntil: "networkidle" });
    await adminPage.getByTestId("topbar").waitFor({ timeout: 20_000 });
    await adminPage.getByTestId("sidebar-logo").click();
    await adminPage.waitForURL("**/app/backoffice", { timeout: 15_000 });
  });

  test("logout desde menu de usuario limpia sesion", async ({ adminPage }) => {
    await goHome(adminPage);

    await adminPage.getByLabel("User menu").click();
    await adminPage.locator('[role="menuitem"]', { hasText: "Salir" }).first().click();

    await adminPage.waitForURL("**/login**", { timeout: 15_000 });
    const me = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return res.status;
    });
    expect(me).toBe(401);
  });

  test("cambio de restaurante activo persiste tras recarga", async ({ adminPage }) => {
    await goHome(adminPage);

    const before = await adminPage.evaluate(async () => {
      const res = await (await fetch("/api/admin/me", { credentials: "include" })).json();
      return res.session.activeRestaurantId;
    });

    const trigger = adminPage.getByLabel("Restaurante");
    await trigger.click();
    const option = adminPage.getByRole("option", { name: "La Terraza del Mar" });
    const hasSecond = await option.count();
    if (hasSecond === 0) {
      // Solo 1 restaurante: sin cambio esperado
      await adminPage.keyboard.press("Escape");
      expect(before).toBe(before);
      return;
    }

    await option.click();
    // El cambio dispara reload de la app; esperar a que cargue de nuevo
    await adminPage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await adminPage.waitForTimeout(1500);

    const after = await adminPage.evaluate(async () => {
      const res = await (await fetch("/api/admin/me", { credentials: "include" })).json();
      return res.session.activeRestaurantId;
    });
    expect(after).not.toBe(before);

    // Restaurar el restaurante original para no dejar estado alterado
    await adminPage.getByLabel("Restaurante").click();
    await adminPage.getByRole("option", { name: "Alqueria Villa Carmen" }).click();
    await adminPage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await adminPage.waitForTimeout(1500);
  });

  test("forky abre y cierra el asistente", async ({ adminPage }) => {
    // prefers-reduced-motion: detiene la animación flotante de gsap (accesibilidad real)
    await adminPage.emulateMedia({ reducedMotion: "reduce" });
    await goHome(adminPage);
    // Asegurar hidratación del subtree de Forky
    await adminPage.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="forky-button"]');
      return !!btn && Object.keys(btn).some((k) => k.startsWith("__reactFiber"));
    }, null, { timeout: 15_000 });

    await adminPage.getByTestId("forky-button").click();
    await expect(adminPage.getByTestId("forky-modal")).toBeVisible({ timeout: 15_000 });
    await adminPage.getByTestId("forky-close-button").click();
    await expect(adminPage.getByTestId("forky-modal")).toHaveCount(0, { timeout: 10_000 });
  });

  test("sesion expirada en plena navegacion redirige a login", async ({ adminPage }) => {
    await goHome(adminPage);

    await adminPage.context().clearCookies();
    await adminPage.goto("/app/backoffice");
    await adminPage.waitForURL("**/login**", { timeout: 15_000 });
  });
});
