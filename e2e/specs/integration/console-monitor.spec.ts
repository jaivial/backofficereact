import { test, expect } from "../../fixtures/session";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";

const PAGES = [
  "/app",
  "/app/reservas",
  "/app/comida",
  "/app/comida/platos",
  "/app/menus",
  "/app/miembros",
  "/app/fichaje",
  "/app/horarios",
  "/app/config",
];

test.describe("Integration - Console Monitoring", () => {
  for (const pagePath of PAGES) {
    test(`no critical console errors on ${pagePath}`, async ({
      adminPage,
    }) => {
      const consoleCapture = captureConsole(adminPage);

      await adminPage.goto(pagePath);
      await adminPage.waitForLoadState("networkidle");
      await adminPage.waitForTimeout(3000); // Wait for all API calls

      const errorCheck = assertNoCriticalErrors(consoleCapture);

      // Log summary for debugging
      console.log(`Console summary for ${pagePath}:`, errorCheck.summary);

      // Fail if there are critical errors
      expect(
        errorCheck.hasErrors,
        `Critical errors on ${pagePath}: ${JSON.stringify({
          errors: errorCheck.criticalErrors,
          pageErrors: errorCheck.criticalPageErrors.map((e) => e.message),
          networkErrors: errorCheck.networkErrors,
        })}`
      ).toBe(false);
    });
  }
});
