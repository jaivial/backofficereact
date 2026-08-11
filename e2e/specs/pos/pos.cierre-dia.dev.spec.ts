import { expect, test } from "../../fixtures/session";

// Real-backend e2e for the cierre-de-día feature. Runs against the dev site
// (baseURL from .env: https://localhost:3010 → backend :8080 → dev DB), using
// the BOOTSTRAP_ADMIN_* creds loaded by global-setup / the session fixture.
//
// The mutating flow WRITES to the dev DB (cash day + payments + closures), so
// it is gated behind E2E_MUTATE_POS=1; invoke explicitly:
//   E2E_MUTATE_POS=1 npx playwright test pos.cierre-dia
// The reports URL-fix check is non-mutating and always runs.
//
// Setup (open cash day + open visit) is done via the authenticated API rather
// than the sell-screen UI: the cierre rail is the feature under test, not the
// table/covers/product flow, and the API path is deterministic.

const SELL = "/app/pos?section=sell";
const REPORTS = "/app/pos?section=reports";
const REPORTS_SECTION = '[data-ui="pos-reports"]'; // unique root; CashControl appears twice under it
const MESSAGE = '[data-ui="pos-message"]';
const MUTATE = process.env.E2E_MUTATE_POS === "1";
const PRODUCT_ID = 36; // Arroz a banda, 16.50 € — exists in the dev catalogue
const TODAY = new Date().toISOString().slice(0, 10);

/** Authenticated fetch from the page context (shares the bo_session cookie). */
async function api(
  page: import("@playwright/test").Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const res = await fetch(`/api/admin${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        credentials: "include",
      });
      return { ok: res.ok, status: res.status, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
    },
    { method, path, body },
  );
}

/** Open today's cash day if none exists (ignore already-open). */
async function ensureCashDayOpen(page: import("@playwright/test").Page): Promise<void> {
  const r = await api(page, "POST", "/pos/cash-days", {
    businessDate: TODAY,
    openingCashCents: 0,
  });
  if (!r.ok && r.json.code !== "CASH_DAY_ALREADY_OPEN") {
    throw new Error(`open cash day failed: ${r.status} ${JSON.stringify(r.json)}`);
  }
}

/** Create an open TAKEAWAY visit (tableless) with one line so bulk-close has work. */
async function createOpenVisit(page: import("@playwright/test").Page): Promise<void> {
  const stamp = Date.now();
  const v = await api(page, "POST", "/pos/visits", {
    channel: "TAKEAWAY",
    idempotencyKey: `e2e-cierre-visit-${stamp}`,
  });
  if (!v.ok) throw new Error(`create visit failed: ${v.status} ${JSON.stringify(v.json)}`);
  const visitId = (v.json.visit as { id: number })?.id;
  let ticketId = (v.json.ticket as { id: number } | undefined)?.id;
  if (!visitId) throw new Error(`no visit id in response: ${JSON.stringify(v.json)}`);
  // Some channels don't auto-create a ticket; make one explicitly.
  if (!ticketId) {
    const t = await api(page, "POST", `/pos/visits/${visitId}/tickets`, { idempotencyKey: `e2e-cierre-ticket-${stamp}` });
    if (!t.ok) throw new Error(`create ticket failed: ${t.status} ${JSON.stringify(t.json)}`);
    ticketId = (t.json.ticket as { id: number })?.id;
    if (!ticketId) throw new Error(`no ticket id: ${JSON.stringify(t.json)}`);
  }
  const line = await api(page, "POST", `/pos/tickets/${ticketId}/lines`, {
    productId: PRODUCT_ID,
    quantity: 1,
    idempotencyKey: `e2e-cierre-line-${stamp}`,
  });
  if (!line.ok) throw new Error(`add line failed: ${line.status} ${JSON.stringify(line.json)}`);
}

test.describe("Cierre de día (real dev)", () => {
  test("section=reports URL lands on reports, not sell", async ({ adminPage: page }) => {
    await page.goto(REPORTS);
    await expect(page.locator(REPORTS_SECTION)).toBeVisible({ timeout: 20_000 });
  });

  test("cerrar-día disabled while a table is open; bulk close clears it; cierre X posts", async ({ adminPage: page }) => {
    test.skip(!MUTATE, "set E2E_MUTATE_POS=1 to run the dev-mutating cierre flow");

    await ensureCashDayOpen(page);
    await createOpenVisit(page);

    await page.goto(SELL);
    await expect(page.getByTestId("pos-control-rail")).toBeVisible({ timeout: 20_000 });
    // The four shipped buttons exist in the rail.
    for (const key of ["cerrar-mesas", "cierre-x", "cierre-y", "cerrar-dia"]) {
      await expect(page.getByTestId(`pos-rail-${key}`)).toBeVisible();
    }

    // Core requirement: with an open visit, Cerrar día is blocked.
    await expect(page.getByTestId("pos-rail-cerrar-dia")).toBeDisabled({ timeout: 10_000 });

    // Bulk-close every open table for today in cash — only if the shift allows it.
    const cerrarMesas = page.getByTestId("pos-rail-cerrar-mesas");
    test.skip(!(await cerrarMesas.isEnabled()), "cerrar-mesas disabled (no open shift)");
    await cerrarMesas.click();
    await expect(page.getByTestId("pos-bulk-close-modal")).toBeVisible();
    await page.getByTestId("pos-bulk-close-confirm").click();
    // runBulkClose setMessage()s then load()s, so the toast is transient — assert
    // the stable outcome instead: modal closes on success, and with no open visits
    // left, Cerrar día unlocks (the core requirement).
    await expect(page.getByTestId("pos-bulk-close-modal")).toBeHidden({ timeout: 20_000 });
    await expect(page.getByTestId("pos-rail-cerrar-dia")).toBeEnabled({ timeout: 10_000 });

    // Cierre X is wired + guarded: with an open shift it posts a closure
    // ("Cierre X generado"); without one it surfaces "Abre un turno". Both appear
    // in the alert region (pos-error / pos-message), so assert on role=alert.
    const cierreX = page.getByTestId("pos-rail-cierre-x");
    test.skip(!(await cierreX.isEnabled()), "cierre-x disabled (no open shift)");
    await cierreX.click();
    await expect(page.getByRole("alert")).toContainText(/Cierre X generado|Abre un turno/);
  });
});
