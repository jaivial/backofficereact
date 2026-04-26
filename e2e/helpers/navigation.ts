/**
 * Navigation helpers for E2E tests.
 */
import type { Page } from "@playwright/test";

export const APP_ROUTES = {
  // Auth
  login: "/login",
  
  // Main
  dashboard: "/app",
  
  // Reservas
  reservas: "/app/reservas",
  reservasCreate: "/app/reservas/anadir",
  reservasConfig: "/app/reservas/config",
  reservasTables: "/app/reservas/tables",
  
  // Comida
  comida: "/app/comida",
  comidaPlatos: "/app/comida/platos",
  comidaVinos: "/app/comida/vinos",
  comidaPostres: "/app/comida/postres",
  comidaBebidas: "/app/comida/bebidas",
  comidaCafes: "/app/comida/cafes",
  
  // Menus
  menus: "/app/menus",
  menusCrear: "/app/menus/crear",
  
  // Miembros
  miembros: "/app/miembros",
  miembrosRoles: "/app/miembros/roles",
  miembrosMiHorario: "/app/miembros/mi-horario",
  
  // Fichaje
  fichaje: "/app/fichaje",
  
  // Horarios
  horarios: "/app/horarios",
  horariosTurnos: "/app/horarios/turnos",
  horariosPreview: "/app/horarios/preview",
  
  // Config
  config: "/app/config",
  configBooking: "/app/config/booking",
  
  // Facturas
  facturas: "/app/facturas",
  facturasRecurrentes: "/app/facturas/recurrentes",
  
  // Estado de Cuenta
  estadoCuenta: "/app/estado-cuenta",
  
  // Reportes
  reportes: "/app/reportes",
  
  // Settings
  settings: "/app/settings",
  
  // Site Builder
  siteBuilder: "/app/site-builder",
  
  // Website
  website: "/app/website",
  
  // Backoffice
  backoffice: "/app/backoffice",
  
  // Comsit
  comsit: "/app/comsit",
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
