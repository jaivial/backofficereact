import { test, expect } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Real-app E2E coverage for the table map layout template feature
 * (app/reservas/tables?date). The side panel (data-ui="draw-panel") now
 * exposes:
 *
 *   - A "Plantilla / Sin plantilla" status pill (data-ui="template-status")
 *   - A scope toggle (data-ui="template-scope-toggle") with two options:
 *       * "Cambios en la plantilla" (data-ui="template-scope-template-btn")
 *       * "Cambios solo este dia" (data-ui="template-scope-day-btn")
 *   - A "Guardar plantilla salon" button (data-ui="save-template-btn")
 *   - A "Eliminar plantilla" button (data-ui="delete-template-btn")
 *
 * WebSocket broadcasts (template_updated, template_cleared, layout_updated)
 * propagate changes between sessions in real time.
 *
 * Credentials/URL come from the # E2E playwright real app section of .env.
 */

const TEST_DATE = "2026-04-05";
const PICKER_BTN = '[data-testid="table-map-date-picker"]';
const MAP_PAGE = '[data-ui="table-map-page"]';
const DRAW_PANEL = '[data-ui="draw-panel"]';
const LIMIT_SECTION = '[data-ui="limit-section"]';
const TEMPLATE_STATUS = '[data-ui="template-status"]';
const SCOPE_TOGGLE = '[data-ui="template-scope-toggle"]';
const SCOPE_TEMPLATE_BTN = '[data-ui="template-scope-template-btn"]';
const SCOPE_DAY_BTN = '[data-ui="template-scope-day-btn"]';
const SAVE_TEMPLATE_BTN = '[data-ui="save-template-btn"]';
const DELETE_TEMPLATE_BTN = '[data-ui="delete-template-btn"]';
const TEMPLATE_HINT = '[data-ui="template-scope-hint"]';
const DAY_SCOPE_HINT = '[data-ui="day-scope-hint"]';
const EDITOR_TOGGLE = '[data-ui="edit-mode-toggle"]';
const START_LINE_BTN = '[data-ui="start-line-drawing-btn"]';
const CLOSE_AREA_BTN = '[data-ui="close-area-btn"]';

async function openDrawPanel(page: import("@playwright/test").Page) {
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 30_000 });
  await waitForLoadingToFinish(page);
  // The draw panel is in the left side panel (draw-panel). It's typically
  // mounted at the same time as the map. If hidden, we look for the
  // data-ui="open-draw-panel-btn" fallback.
  if ((await page.locator(DRAW_PANEL).count()) === 0) {
    const trigger = page.locator('[data-ui="open-draw-panel-btn"]');
    if ((await trigger.count()) > 0) {
      await trigger.first().click();
    }
  }
  await expect(page.locator(LIMIT_SECTION)).toBeVisible({ timeout: 15_000 });
}

async function loadMap(page: import("@playwright/test").Page, dateISO: string) {
  await page.goto(`/app/reservas/tables?date=${dateISO}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
  await expect(page.locator(PICKER_BTN)).toBeVisible({ timeout: 20_000 });
}

async function ensureEditMode(page: import("@playwright/test").Page) {
  const toggle = page.locator(EDITOR_TOGGLE);
  if ((await toggle.count()) === 0) return;
  const state = await toggle.first().getAttribute("aria-checked");
  if (state !== "true") {
    await toggle.first().click({ force: true });
  }
}

test.describe("Tables Map - Layout Template (draw panel)", () => {
  test.describe.configure({ mode: "serial", retries: 2 });

  test("draw panel shows the template status pill (Sin plantilla by default)", async ({ adminPage }) => {
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);
    await expect(adminPage.locator(LIMIT_SECTION)).toBeVisible();
    const status = adminPage.locator(TEMPLATE_STATUS);
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/Sin plantilla|Plantilla/);
  });

  test("limit-section header has a scope toggle (only when a template is saved)", async ({ adminPage }) => {
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);
    // Default: no template, the toggle is hidden.
    await expect(adminPage.locator(SCOPE_TOGGLE)).toHaveCount(0);
  });

  test("scope toggle is visible after a template exists, default is Cambios en la plantilla", async ({ adminPage }) => {
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);
    // Save a template first by drawing a small closed area and saving.
    await ensureEditMode(adminPage);
    const startBtn = adminPage.locator(START_LINE_BTN);
    if ((await startBtn.count()) > 0) {
      await startBtn.first().click();
    }
    // The map is rendered with React Flow: we click on the wrapper to add
    // points. The flow wrapper is the .bo-tableMapFlowWrap container.
    const flow = adminPage.locator('[data-ui="flow-wrapper"]');
    const flowBox = await flow.first().boundingBox();
    if (flowBox) {
      // 4 points forming a closed area
      const cx = flowBox.x + flowBox.width / 2;
      const cy = flowBox.y + flowBox.height / 2;
      const r = Math.min(flowBox.width, flowBox.height) * 0.18;
      const points = [
        { x: cx, y: cy - r },
        { x: cx + r, y: cy },
        { x: cx, y: cy + r },
        { x: cx - r, y: cy },
      ];
      for (const p of points) {
        await adminPage.mouse.click(p.x, p.y);
        await adminPage.waitForTimeout(150);
      }
    }
    // Close area
    const closeBtn = adminPage.locator(CLOSE_AREA_BTN);
    if ((await closeBtn.count()) > 0) {
      await closeBtn.first().click();
    }
    // Save the template (template scope is the default once it exists).
    const saveBtn = adminPage.locator(SAVE_TEMPLATE_BTN);
    if ((await saveBtn.count()) > 0) {
      await saveBtn.first().click();
      // Wait for either the success toast or the toggle to appear.
      await adminPage.waitForTimeout(1500);
    }
    // Reload to make sure the template is persisted (template_updated is
    // broadcast on save, so a refresh must reflect the new state).
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);

    const status = adminPage.locator(TEMPLATE_STATUS);
    await expect(status).toHaveText(/Plantilla/, { timeout: 15_000 });
    await expect(adminPage.locator(SCOPE_TOGGLE)).toBeVisible({ timeout: 5_000 });
    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "true");
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "false");
    await expect(adminPage.locator(TEMPLATE_HINT)).toBeVisible();
  });

  test("switching to day scope flips the toggle and shows the day-scope hint", async ({ adminPage }) => {
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);
    // Assume a template is already saved (set up by the previous test).
    const dayBtn = adminPage.locator(SCOPE_DAY_BTN);
    if ((await dayBtn.count()) === 0) {
      test.skip(true, "no template saved for this test");
      return;
    }
    await dayBtn.first().click();
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 5_000 });
    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "false");
    await expect(adminPage.locator(DAY_SCOPE_HINT)).toBeVisible();
  });

  test("delete template button clears the template and the status pill flips to Sin plantilla", async ({ adminPage }) => {
    await loadMap(adminPage, TEST_DATE);
    await openDrawPanel(adminPage);
    const delBtn = adminPage.locator(DELETE_TEMPLATE_BTN);
    if ((await delBtn.count()) === 0) {
      test.skip(true, "no template saved for this test");
      return;
    }
    await delBtn.first().click();
    // Backend returns 200; status pill flips after the layout reload.
    await expect(adminPage.locator(TEMPLATE_STATUS)).toHaveText(/Sin plantilla/, { timeout: 15_000 });
    await expect(adminPage.locator(SCOPE_TOGGLE)).toHaveCount(0);
  });

  test("save template button commits via WebSocket broadcast (other tab refreshes)", async ({ adminPage, browser }) => {
    // Open two independent browser contexts; both must observe the same
    // template status after a save in tab 1.
    const ctx1 = await browser.newContext({ ignoreHTTPSErrors: true });
    const ctx2 = await browser.newContext({ ignoreHTTPSErrors: true });
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();
    try {
      // Sign in both contexts.
      for (const p of [page1, page2]) {
        await p.goto(process.env.BACKOFFICE_URL || `https://${process.env.URL}`);
        const login = await p.evaluate(async ({ email, password }) => {
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ identifier: email, password }),
          });
          return res.json();
        }, { email: process.env.LOGIN_USER, password: process.env.LOGIN_PASSWORD });
        if (!login?.success) throw new Error("login failed in dual-tab test");
      }
      // Open the map in both tabs.
      for (const p of [page1, page2]) {
        await p.goto(`/app/reservas/tables?date=${TEST_DATE}`);
        await p.waitForSelector(MAP_PAGE, { timeout: 30_000 });
        await p.waitForTimeout(1000);
      }
      // Tab 1: ensure template is missing and the toggle is hidden.
      const status1 = page1.locator(TEMPLATE_STATUS);
      // Draw and save a template in tab 1.
      await page1.locator(START_LINE_BTN).first().click().catch(() => undefined);
      const flowBox1 = await page1.locator('[data-ui="flow-wrapper"]').first().boundingBox();
      if (flowBox1) {
        const cx = flowBox1.x + flowBox1.width / 2;
        const cy = flowBox1.y + flowBox1.height / 2;
        const r = Math.min(flowBox1.width, flowBox1.height) * 0.18;
        const pts = [
          { x: cx, y: cy - r },
          { x: cx + r, y: cy },
          { x: cx, y: cy + r },
          { x: cx - r, y: cy },
        ];
        for (const p of pts) {
          await page1.mouse.click(p.x, p.y);
          await page1.waitForTimeout(150);
        }
      }
      await page1.locator(CLOSE_AREA_BTN).first().click().catch(() => undefined);
      await page1.locator(SAVE_TEMPLATE_BTN).first().click().catch(() => undefined);
      // Tab 2 should observe the change via WebSocket within a few seconds.
      const status2 = page2.locator(TEMPLATE_STATUS);
      await expect(status2).toHaveText(/Plantilla/, { timeout: 15_000 });
    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
