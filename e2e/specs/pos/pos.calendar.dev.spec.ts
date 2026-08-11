import { expect, test } from "../../fixtures/session";

// Real-backend e2e for the POS calendar menu + sealed-day read-only mode (#18).
// Runs against the dev site (baseURL from .env). The calendar/menu wiring test
// is fully non-mutating and always runs. The read-only test navigates to a past
// CLOSED cash day (also non-mutating) but skips gracefully if the dev DB has no
// sealed historical day to point at.

const SELL = "/app/pos?section=sell";

test.describe("Calendario + día cerrado (real dev)", () => {
  test("3-dot menu opens the calendar modal; Escape dismisses it", async ({ adminPage: page }) => {
    await page.goto(SELL);
    await expect(page.getByTestId("pos-control-rail")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("pos-section-menu").click();
    await page.getByTestId("pos-section-calendar").click();

    await expect(page.getByTestId("pos-calendar-modal")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("pos-calendar-goto")).toBeVisible();
    await expect(page.getByTestId("pos-calendar-detail")).toBeVisible();

    // The calendar modal IS dismissable (unlike the unclosed-days gate).
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pos-calendar-modal")).toBeHidden({ timeout: 10_000 });
  });

  test("a sealed day loads read-only: notice shown, rail locked", async ({ adminPage: page }) => {
    // Find a past CLOSED cash day to point the POS at. Skip if the dev DB has none.
    const res = await page.evaluate(async () => {
      const to = new Date();
      const from = new Date(to.getTime() - 60 * 24 * 60 * 60 * 1000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const r = await fetch(`/api/admin/pos/cash-days?from=${fmt(from)}&to=${fmt(to)}`, { credentials: "include" });
      const json = (await r.json().catch(() => ({}))) as { success?: boolean; items?: Array<{ date: string; status: string }> };
      return (json.items || []).filter((d) => d.status === "CLOSED").map((d) => d.date);
    });
    test.skip(!res.length, "no past CLOSED cash day in the dev DB");

    await page.goto(`/app/pos?section=sell&date=${res[res.length - 1]}`);
    await expect(page.getByTestId("pos-readonly-notice")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("pos-rail-comanda")).toBeDisabled();
    await expect(page.getByTestId("pos-keypad-confirm")).toBeDisabled();
  });
});
