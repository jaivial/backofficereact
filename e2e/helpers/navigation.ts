/**
 * Navigation helpers for E2E tests.
 */
import type { Page } from "@playwright/test";

export const APP_ROUTES = {
  login: "/login",
  dashboard: "/app",
  reservas: "/app/reservas",
  reservasCreate: "/app/reservas/anadir",
  reservasConfig: "/app/reservas/config",
  reservasTables: "/app/reservas/tables",
  comida: "/app/comida",
  comidaPlatos: "/app/comida/platos",
  comidaVinos: "/app/comida/vinos",
  comidaPostres: "/app/comida/postres",
  comidaBebidas: "/app/comida/bebidas",
  comidaCafes: "/app/comida/cafes",
  menus: "/app/menus",
  menusCrear: "/app/menus/crear",
  miembros: "/app/miembros",
  miembrosRoles: "/app/miembros/roles",
  fichaje: "/app/fichaje",
  horarios: "/app/horarios",
  config: "/app/config",
  settings: "/app/settings",
  facturas: "/app/facturas",
  estadoCuenta: "/app/estado-cuenta",
  reportes: "/app/reportes",
} as const;

export type AppRoute = keyof typeof APP_ROUTES;

/**
 * Navigate to a named app route and wait for it to be ready.
 */
export async function navigateTo(page: Page, route: keyof typeof APP_ROUTES) {
  await page.goto(APP_ROUTES[route]);
  await page.waitForLoadState("networkidle");
}

/**
 * Navigate to a path and wait for the page to be stable.
 */
export async function gotoAndWait(
  page: Page,
  path: string,
  options?: { waitForSelector?: string; timeout?: number }
) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  if (options?.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, {
      timeout: options.timeout || 10_000,
    });
  }
}

/**
 * Wait for the sidebar to be present (indicates app has loaded).
 */
export async function waitForAppReady(page: Page) {
  await page.waitForSelector('[data-ui="sidebar"], [data-testid="sidebar"], nav, aside', {
    timeout: 15_000,
  });
}

/**
 * Navigate using the sidebar.
 */
export async function clickSidebarItem(page: Page, label: string) {
  // Try multiple selector strategies for sidebar items
  const selectors = [
    `nav a:has-text("${label}")`,
    `aside a:has-text("${label}")`,
    `[data-ui="sidebar"] a:has-text("${label}")`,
    `button:has-text("${label}")`,
    `a[href*="${label.toLowerCase()}"]`,
  ];

  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if ((await el.count()) > 0) {
      await el.click();
      await page.waitForLoadState("networkidle");
      return;
    }
  }

  throw new Error(`Sidebar item "${label}" not found`);
}
