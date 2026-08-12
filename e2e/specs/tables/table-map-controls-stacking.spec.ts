import { test, expect } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * The limit-area lines are drawn in an absolutely-positioned SVG
 * (data-ui="line-draw-overlay") that sits as a SIBLING of the React Flow
 * wrapper inside .bo-tableMapFlowWrap. React Flow applies an inline
 * `z-index: 0` to its root, which creates a stacking context that traps the
 * controls panel (.react-flow__controls, z-index 5) underneath the overlay
 * regardless of the overlay's own z-index.
 *
 * Regression coverage for:
 *   1. The limit-area lines must never paint above the bottom-left controls
 *      panel.
 *   2. The first/last control buttons must round their outer corners to match
 *      the controls panel container.
 */

const TEST_DATE = "2026-04-05";
const MAP_PAGE = '[data-ui="table-map-page"]';
const DRAW_PANEL = '[data-ui="draw-panel"]';
const LIMIT_SECTION = '[data-ui="limit-section"]';
const EDITOR_TOGGLE = '[data-ui="edit-mode-toggle"]';
const START_LINE_BTN = '[data-ui="start-line-drawing-btn"]';
const CLOSE_AREA_BTN = '[data-ui="close-area-btn"]';
const FLOW_WRAP = '[data-ui="flow-wrapper"]';
const FLOW = ".bo-tableMapFlow";
const OVERLAY = '[data-ui="line-draw-overlay"]';
const CONTROLS = ".react-flow__controls";
const CONTROLS_BUTTON = ".react-flow__controls-button";

async function loadMap(page: import("@playwright/test").Page) {
  await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
}

async function ensureEditMode(page: import("@playwright/test").Page) {
  const toggle = page.locator(EDITOR_TOGGLE);
  if ((await toggle.count()) === 0) return;
  const state = await toggle.first().getAttribute("aria-checked");
  if (state !== "true") {
    await toggle.first().click({ force: true });
  }
}

async function drawClosedArea(page: import("@playwright/test").Page) {
  const panel = page.locator(DRAW_PANEL);
  if ((await panel.count()) === 0) {
    const trigger = page.locator('[data-ui="open-draw-panel-btn"]');
    if ((await trigger.count()) > 0) await trigger.first().click();
  }
  await expect(page.locator(LIMIT_SECTION)).toBeVisible({ timeout: 15_000 });

  await ensureEditMode(page);

  const startBtn = page.locator(START_LINE_BTN);
  if ((await startBtn.count()) > 0) await startBtn.first().click();

  const flow = page.locator(FLOW_WRAP);
  const flowBox = await flow.first().boundingBox();
  if (flowBox) {
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
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(120);
    }
  }

  const closeBtn = page.locator(CLOSE_AREA_BTN);
  if ((await closeBtn.count()) > 0) await closeBtn.first().click();

  await expect(page.locator(OVERLAY)).toBeVisible({ timeout: 10_000 });
}

test.describe("Tables Map - controls panel stacking", () => {
  test.describe.configure({ retries: 2 });

  test("limit-area lines do not stack above the controls panel", async ({ adminPage }) => {
    await loadMap(adminPage);
    await drawClosedArea(adminPage);

    // Root cause: React Flow's root must not establish a z-index stacking
    // context, so its internal controls panel (z-index 5) competes directly
    // with the sibling overlay (z-index 4).
    const flowZ = await adminPage.locator(FLOW).evaluate((el) => getComputedStyle(el).zIndex);
    expect(flowZ).toBe("auto");

    const overlayZ = await adminPage.locator(OVERLAY).evaluate((el) => Number(getComputedStyle(el).zIndex));
    const controlsZ = await adminPage.locator(CONTROLS).evaluate((el) => Number(getComputedStyle(el).zIndex));
    expect(controlsZ).toBeGreaterThan(overlayZ);
  });

  test("control buttons round their outer corners to match the panel container", async ({ adminPage }) => {
    await loadMap(adminPage);

    const first = adminPage.locator(CONTROLS_BUTTON).first();
    const last = adminPage.locator(CONTROLS_BUTTON).last();
    await expect(first).toBeVisible();
    await expect(last).toBeVisible();

    const firstTopLeft = await first.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    const firstTopRight = await first.evaluate((el) => getComputedStyle(el).borderTopRightRadius);
    expect(firstTopLeft).not.toBe("0px");
    expect(firstTopRight).not.toBe("0px");

    const lastBottomLeft = await last.evaluate((el) => getComputedStyle(el).borderBottomLeftRadius);
    const lastBottomRight = await last.evaluate((el) => getComputedStyle(el).borderBottomRightRadius);
    expect(lastBottomLeft).not.toBe("0px");
    expect(lastBottomRight).not.toBe("0px");
  });
});
