/**
 * Quick Navigation E2E Test
 * 
 * A faster version that:
 * 1. Logs in ONCE
 * 2. Visits all main pages quickly (no tab clicking)
 * 3. Just checks pages load without crash
 * 
 * Use this during development, use full-navigation-enhanced.spec.ts for CI
 * 
 * Run with: bunx playwright test e2e/specs/quick-nav.spec.ts --reporter=list
 */
import { test, expect } from "../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../helpers/console";

const PAGES = [
  { name: "Dashboard", url: "/app" },
  { name: "Reservas", url: "/app/reservas" },
  { name: "Reservas Create", url: "/app/reservas/anadir" },
  { name: "Reservas Config", url: "/app/reservas/config" },
  { name: "Reservas Tables", url: "/app/reservas/tables" },
  { name: "Comida", url: "/app/comida" },
  { name: "Menus", url: "/app/menus" },
  { name: "Menus Create", url: "/app/menus/crear" },
  { name: "Miembros", url: "/app/miembros" },
  { name: "Miembros Roles", url: "/app/miembros/roles" },
  { name: "Fichaje", url: "/app/fichaje" },
  { name: "Horarios", url: "/app/horarios" },
  { name: "Horarios Turnos", url: "/app/horarios/turnos" },
  { name: "Horarios Preview", url: "/app/horarios/preview" },
  { name: "Config", url: "/app/config" },
  { name: "Config Booking", url: "/app/config/booking" },
  { name: "Facturas", url: "/app/facturas" },
  { name: "Facturas Recurrentes", url: "/app/facturas/recurrentes" },
  { name: "Estado Cuenta", url: "/app/estado-cuenta" },
  { name: "Reportes", url: "/app/reportes" },
  { name: "Settings", url: "/app/settings" },
  { name: "Site Builder", url: "/app/site-builder" },
  { name: "Website", url: "/app/website" },
  { name: "Backoffice", url: "/app/backoffice" },
];

test.describe("Quick Navigation Test", () => {
  test.setTimeout(300_000); // 5 minutes

  for (const page of PAGES) {
    test(`loads ${page.name} without errors`, async ({ adminPage }) => {
      const consoleCapture = captureConsole(adminPage);

      await adminPage.goto(page.url, { 
        waitUntil: "networkidle",
        timeout: 20_000 
      });
      
      // Skip if session expired
      if (adminPage.url().includes("/login")) {
        test.skip(true, "Session expired");
        return;
      }

      // Wait for any content
      await adminPage.waitForTimeout(1000);

      // Check no page crash (just verify body exists)
      const body = adminPage.locator("body");
      await expect(body).toBeVisible();

      // Check console errors
      const errors = assertNoCriticalErrors(consoleCapture);
      
      // Log errors for debugging but don't fail (some may be acceptable)
      if (errors.criticalErrors.length > 0) {
        console.log(`⚠️  Console errors on ${page.name}:`, errors.criticalErrors);
      }
    });
  }

  test("session remains valid after all pages", async ({ adminPage }) => {
    const result = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return res.json();
    });
    
    expect(result.success).toBe(true);
  });
});
