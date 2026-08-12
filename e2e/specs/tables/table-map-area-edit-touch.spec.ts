import { test, expect, type Page } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";
import { e2eEnv } from "../../config";

/**
 * Mobile area editing (limit polygon) coverage on an iPhone 12 context.
 *
 * The limit-area overlay used to be mouse-only (`onMouseDown` drag,
 * `onDoubleClick` add/delete). Touch has no native dblclick and synthesized
 * mousedown is unreliable, so on phones you could not drag joint circles nor
 * double-tap lines to add joints. Fixes:
 *   - Pointer Events + window-level move/up listeners for drag.
 *   - Manual double-tap detection for touch/pen (native dblclick stays for mouse).
 *   - Joint circles rendered ABOVE the fat-finger segment hit lines.
 *   - `touch-action: none` on the flow wrapper while editing so the browser
 *     does not cancel the gesture (pointercancel) and scroll the page.
 *
 * Gestures are dispatched as real touch via CDP `Input.dispatchTouchEvent`, so
 * hit-testing and touch-action are exercised (synthetic `dispatchEvent` would
 * bypass both).
 */

const TEST_DATE = "2026-04-05";
const MAP_PAGE = '[data-ui="table-map-page"]';
const EDIT_SWITCH = '[data-ui="edit-mode-toggle"] button';
const EDIT_AREA_BTN = '[data-ui="edit-area-btn"]';
const EDITING_BADGE = '[data-ui="editing-badge"]';
const CLOSE_PANEL_BTN = '[data-ui="close-draw-panel-btn"]';
const VERTEX = '[data-ui="line-vertex"]';
const SEGMENT_HIT = '[data-ui="line-segment-hit"]';
const CLOSING_HIT = '[data-ui="line-closing-hit"]';

const SEED_POINTS = [
  { x: 100, y: 0 },
  { x: 300, y: 0 },
  { x: 300, y: 300 },
  { x: 100, y: 300 },
];

async function seedClosedArea(page: Page) {
  const res = await page.evaluate(async ({ url, date, points }) => {
    const r = await fetch(`${url}/api/admin/tables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        entity: "layout",
        date,
        floor_number: 0,
        metadata: { limit_points: points },
      }),
    });
    return r.status;
  }, { url: e2eEnv.baseURL, date: TEST_DATE, points: SEED_POINTS });
  expect(res).toBe(200);
}

async function loadMap(page: Page) {
  await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
}

async function enterAreaEditing(page: Page) {
  const editSwitch = page.locator(EDIT_SWITCH);
  if ((await editSwitch.getAttribute("aria-checked")) !== "true") {
    await editSwitch.click();
  }
  const editArea = page.locator(EDIT_AREA_BTN);
  await expect(editArea).toBeVisible({ timeout: 10_000 });
  await editArea.click();
  await expect(page.locator(EDITING_BADGE)).toBeVisible({ timeout: 10_000 });
  // The draw panel covers the canvas on phones; close it to reach the joints.
  const closePanel = page.locator(CLOSE_PANEL_BTN);
  if ((await closePanel.count()) > 0) await closePanel.first().click();
  // Wait for the slide-out transition to finish so the panel no longer
  // intercepts touches aimed at the canvas.
  await page.waitForTimeout(400);
  await expect(page.locator(VERTEX).first()).toBeVisible({ timeout: 10_000 });
}

async function makeTouchSender(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  return async (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) => {
    await cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: [{ x, y, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
  };
}

async function touchDrag(
  send: (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) => Promise<void>,
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 6,
) {
  await send("touchStart", from.x, from.y);
  for (let i = 1; i <= steps; i += 1) {
    await send(
      "touchMove",
      from.x + ((to.x - from.x) * i) / steps,
      from.y + ((to.y - from.y) * i) / steps,
    );
    await page.waitForTimeout(25);
  }
  await send("touchEnd", to.x, to.y);
}

async function touchDoubleTap(
  send: (type: "touchStart" | "touchMove" | "touchEnd", x: number, y: number) => Promise<void>,
  x: number,
  y: number,
) {
  for (let i = 0; i < 2; i += 1) {
    await send("touchStart", x, y);
    await send("touchEnd", x, y);
  }
}

async function centerOf(locator: import("@playwright/test").Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test.describe("Tables Map - Area Edit (touch)", () => {
  test.describe.configure({ mode: "serial", retries: 2 });

  test("drags a joint circle with touch without panning the map", async ({ adminTouchPage }) => {
    await seedClosedArea(adminTouchPage);
    await loadMap(adminTouchPage);
    await enterAreaEditing(adminTouchPage);

    const circle = adminTouchPage.locator(VERTEX).first();
    const before = await centerOf(circle);
    const viewportBefore = await adminTouchPage.evaluate(() =>
      document.querySelector(".react-flow__viewport")?.getAttribute("style"),
    );

    const send = await makeTouchSender(adminTouchPage);
    await touchDrag(send, adminTouchPage, before, { x: before.x + 60, y: before.y + 40 });
    await adminTouchPage.waitForTimeout(300);

    const after = await centerOf(circle);
    expect(after.x).not.toBeCloseTo(before.x, 1);
    expect(after.y).not.toBeCloseTo(before.y, 1);

    const viewportAfter = await adminTouchPage.evaluate(() =>
      document.querySelector(".react-flow__viewport")?.getAttribute("style"),
    );
    expect(viewportAfter).toBe(viewportBefore);
  });

  test("double-tap on a segment adds a joint", async ({ adminTouchPage }) => {
    await seedClosedArea(adminTouchPage);
    await loadMap(adminTouchPage);
    await enterAreaEditing(adminTouchPage);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(4);
    const segment = adminTouchPage.locator(SEGMENT_HIT).first();
    const mid = await centerOf(segment);

    const send = await makeTouchSender(adminTouchPage);
    await touchDoubleTap(send, mid.x, mid.y);
    await adminTouchPage.waitForTimeout(300);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(5);
  });

  test("double-tap on a joint deletes it", async ({ adminTouchPage }) => {
    await seedClosedArea(adminTouchPage);
    await loadMap(adminTouchPage);
    await enterAreaEditing(adminTouchPage);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(4);
    const circle = adminTouchPage.locator(VERTEX).first();
    const center = await centerOf(circle);

    const send = await makeTouchSender(adminTouchPage);
    await touchDoubleTap(send, center.x, center.y);
    await adminTouchPage.waitForTimeout(300);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(3);
  });

  test("double-tap on the closing segment appends a joint", async ({ adminTouchPage }) => {
    await seedClosedArea(adminTouchPage);
    await loadMap(adminTouchPage);
    await enterAreaEditing(adminTouchPage);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(4);
    const closing = adminTouchPage.locator(CLOSING_HIT);
    await expect(closing).toHaveCount(1);
    const mid = await centerOf(closing);

    const send = await makeTouchSender(adminTouchPage);
    await touchDoubleTap(send, mid.x, mid.y);
    await adminTouchPage.waitForTimeout(300);

    await expect(adminTouchPage.locator(VERTEX)).toHaveCount(5);
  });
});
