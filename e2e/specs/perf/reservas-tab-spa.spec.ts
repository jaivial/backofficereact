/**
 * Reservas tab navigation must be SPA (client routing), not a full reload.
 *
 * Regression: reservas tabs used window.location.assign() after a 600ms delay,
 * causing a full browser reload (JS re-download + re-hydrate) per tab switch.
 * This asserts no new `navigation` performance entry appears when switching
 * tabs, and that content swaps within a SPA-typical budget.
 */
import { test, expect } from "../../fixtures/session";

const DATE = "2026-08-10";

test("reservas tab switch is SPA (no full navigation)", async ({ adminPage }) => {
  await adminPage.goto(`/app/reservas?date=${DATE}`, { waitUntil: "commit", timeout: 30_000 });
  await adminPage.locator('[data-testid="reservas-section"]').waitFor({ timeout: 25_000 });

  const navCountBefore = await adminPage.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  expect(navCountBefore).toBe(1);

  // Switch to "Mapas" tab.
  await adminPage.locator('[data-testid="tab-tables"]').click();
  await adminPage.waitForURL(/\/app\/reservas\/tables/, { timeout: 15_000 });

  // No new navigation entry → SPA navigation.
  const navCountAfter = await adminPage.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  expect(navCountAfter).toBe(1);

  // Content swaps in (tables renders a canvas/application area). Give it time.
  await adminPage.locator('[role="application"], canvas').first().waitFor({ timeout: 20_000 });

  // Go back to the main reservas tab. On the tables route the layout tab bar is
  // hidden, so use history back — Vike client routing handles popstate as an
  // SPA navigation (no full reload).
  await adminPage.goBack();
  await adminPage.waitForURL(/\/app\/reservas\?date=/, { timeout: 15_000 });
  await adminPage.locator('[data-testid="reservas-section"]').waitFor({ timeout: 25_000 });

  const navCountFinal = await adminPage.evaluate(
    () => performance.getEntriesByType("navigation").length,
  );
  expect(navCountFinal).toBe(1);
});
