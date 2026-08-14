import { test, expect, type Page } from "../../fixtures/session";
import type { Locator } from "@playwright/test";
import { waitForLoadingToFinish } from "../../helpers/wait";
import type { TestApiClient } from "../../helpers/api-client";

/**
 * Mobile (touch) resize of table nodes in edit mode.
 *
 * Bug: dragging a NodeResizer corner handle with a finger resized the node a
 * few pixels and then the gesture died ("pierde la selección del vértice").
 * Root causes (all mobile-only, desktop is immune because its move/end
 * listeners live on `window`):
 *
 * 1. d3-drag's TOUCH move/end listeners live on the handle element itself.
 *    Every resize step triggers node dimension changes -> React re-render ->
 *    new inline `onResizeEnd` closures -> the ResizeControl effect re-runs
 *    (`selection.on('.drag', null)` + rebind) and the in-flight gesture state
 *    (kept in the old handler closure) is lost. Fixed by StableNodeResizer
 *    (ref-stabilized callbacks).
 *
 * 2. The 10px corner handles render at ~4-5px on screen at typical map zoom —
 *    a finger cannot land on them, and a missed grab starts a node drag /
 *    pane pan instead. Fixed with a coarse-pointer hit ring (::after) plus
 *    touch-action: none on the handles.
 *
 * 3. Only onResizeEnd existed, so the table visual did not follow the finger
 *    during the gesture. Fixed by wiring onResize to a live (non-persisting)
 *    node size update; persistence still runs through onResizeEnd.
 *
 * Gestures are dispatched as synthetic TouchEvents on the handle (the d3
 * touch path), one per step with a delay so React flushes re-renders between
 * moves — exactly what killed the old gesture. Real CDP
 * `Input.dispatchTouchEvent` does not drive d3-drag's touchmove reliably in
 * this emulation, so it is not used here.
 */

const TEST_DATE = "2026-04-05";
const EDIT_SWITCH = '[data-ui="edit-mode-toggle"] button';
const CLOSE_PANEL_BTN = '[data-ui="close-draw-panel-btn"]';
const TABLE_NODE = '[data-ui="table-node"]';
const BR_HANDLE = ".react-flow__resize-control.handle.bottom.right";

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

async function flowZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    if (!el) return 1;
    const m = el.style.transform.match(/scale\(([\d.]+)\)/);
    return m ? Number(m[1]) : 1;
  });
}

/**
 * Open the tables page and wait for table nodes. Retries once on a transient
 * dev-server error page (vike recompiles under HMR can briefly 500).
 */
async function loadTablesPage(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
    await waitForLoadingToFinish(page);
    const nodes = page.locator(TABLE_NODE);
    const ok = await nodes.first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    await page.reload();
  }
}

async function enterEditMode(page: Page) {
  const editSwitch = page.locator(EDIT_SWITCH).first();
  await expect(editSwitch).toBeVisible({ timeout: 15_000 });
  if ((await editSwitch.getAttribute("aria-checked")) !== "true") {
    await editSwitch.click();
  }
  // The draw panel covers the canvas; wait for it to render, close it and let
  // the slide-out transition finish so it stops intercepting taps.
  const closePanel = page.locator(CLOSE_PANEL_BTN);
  await expect(closePanel.first()).toBeVisible({ timeout: 10_000 });
  await closePanel.first().click();
  await page.waitForTimeout(400);
}

/**
 * Primitive touch events on the selected table's bottom-right handle, plus a
 * state reader. Synthetic TouchEvents exercise the d3 touch path; the delay
 * between moves lets React commit re-renders mid-gesture (what killed the
 * old gesture). Real CDP `Input.dispatchTouchEvent` does not drive d3-drag's
 * touchmove reliably in this emulation, so it is not used here.
 */

function dispatchTouch(page: Page, type: string, x: number, y: number) {
  return page.evaluate(
    ([type2, x2, y2]) => {
      const node = (document.querySelector('[data-ui="table-node"].is-selected') ??
        document.querySelector('[data-ui="table-node"]')) as HTMLElement;
      const h = node.querySelector(".react-flow__resize-control.handle.bottom.right") as HTMLElement;
      const touch = new Touch({
        identifier: 7,
        target: h,
        clientX: x2,
        clientY: y2,
        radiusX: 2,
        radiusY: 2,
        force: 1,
      });
      const active = type2 === "touchend" ? [] : [touch];
      h.dispatchEvent(
        new TouchEvent(type2, {
          touches: active,
          targetTouches: active,
          changedTouches: [touch],
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    [type, x, y] as [string, number, number],
  );
}

async function touchStart(page: Page, p: { x: number; y: number }) {
  await dispatchTouch(page, "touchstart", p.x, p.y);
}

async function touchMove(page: Page, x: number, y: number) {
  await dispatchTouch(page, "touchmove", x, y);
}

async function touchEnd(page: Page, x: number, y: number) {
  await dispatchTouch(page, "touchend", x, y);
}

async function resizeState(page: Page) {
  return page.evaluate(() => {
    const n = (document.querySelector('[data-ui="table-node"].is-selected') ??
      document.querySelector('[data-ui="table-node"]')) as HTMLElement;
    const wr = n.parentElement as HTMLElement;
    return {
      wrapper: Number.parseFloat(wr.style.width) || 0,
      inner: Number.parseFloat(n.style.width) || 0,
    };
  });
}

/** Select the first table (edit mode already on). Retries because clicking an
 * already-selected table toggles it off; the previous run's WS snapshot may
 * briefly keep a stale selection. */
async function selectFirstTable(page: Page): Promise<Locator> {
  const node = page.locator(TABLE_NODE).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await node.dispatchEvent("click");
    await page.waitForTimeout(150);
    const selected = await page.evaluate(() =>
      Boolean(document.querySelector('[data-ui="table-node"].is-selected')),
    );
    if (selected) return node;
  }
  return node;
}

/** Spread tables apart so their resize handles never overlap each other. */
async function seedTablePositions(api: TestApiClient) {
  await api.delete(`/api/admin/tables/template/0`).catch(() => undefined);
  const list = (await api.get(`/api/admin/tables?date=${TEST_DATE}&floor_number=0`)) as {
    tables?: Array<{ id: number }>;
  };
  const tables = (list.tables || []).filter((t) => Number(t.id) > 0);
  // Reset persisted resize sizes so tables return to their default box
  // (previous runs grow widths unboundedly, which makes handles overlap).
  for (const t of tables) {
    await api
      .put("/api/admin/tables", {
        entity: "table",
        id: Number(t.id),
        metadata: { width: null, height: null },
      })
      .catch(() => undefined);
  }
  const positions: Record<string, unknown> = {};
  // Wide spacing: corner handles must never overlap a neighbour's box.
  const spacing = 800;
  tables.forEach((t, i) => {
    positions[String(t.id)] = { x_pos: i * spacing, y_pos: 0 };
  });
  const maxX = Math.max(0, (tables.length - 1) * spacing);
  await api
    .put("/api/admin/tables", {
      entity: "layout",
      date: TEST_DATE,
      floor_number: 0,
      metadata: {
        _template_scope: null,
        _table_positions_override: null,
        _limit_area_template_points_override: null,
        _draw_elements_template_override: null,
        elements: null,
        booking_states: null,
        table_positions: positions,
        limit_points: [
          { x: -2000, y: -2000 },
          { x: maxX + 2000, y: -2000 },
          { x: maxX + 2000, y: 2000 },
          { x: -2000, y: 2000 },
        ],
      },
    })
    .catch(() => undefined);
}

test.describe("Tables Map - Table resize (touch)", () => {
  test.describe.configure({ mode: "serial", retries: 3 });

  test.beforeEach(async ({ api }) => {
    await seedTablePositions(api);
  });

  test("touch drag on corner handle grows the table continuously", async ({ adminTouchPage }) => {
    const page = adminTouchPage;
    await loadTablesPage(page);
    const node = page.locator(TABLE_NODE).first();
    await enterEditMode(page);

    // Select the table so the resize handles appear (setup — the touch
    // GESTURE below is the thing under test).
    await selectFirstTable(page);
    // Make sure the handle is inside the viewport: elementFromPoint returns
    // null for off-screen points and a touch there would hit nothing.
    await node.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const handle = node.locator(BR_HANDLE).first();
    await expect(handle).toBeVisible({ timeout: 10_000 });
    // Wait until d3-drag is actually bound on the handle (it sets
    // touch-action: none at bind time). A WS snapshot right after selection can
    // remount the node, and dispatching the gesture before the effect runs
    // silently does nothing.
    await page.waitForFunction(() => {
      const n = (document.querySelector('[data-ui="table-node"].is-selected') ??
        document.querySelector('[data-ui="table-node"]')) as HTMLElement | null;
      const h = n?.querySelector(".react-flow__resize-control.handle.bottom.right") as HTMLElement | null;
      return Boolean(h && h.style.touchAction === "none");
    }, undefined, { timeout: 10_000 });

    const handleCenter = await centerOf(handle);
    const zoom = await flowZoom(page);
    // Screen-space delta that maps to ~80 flow px of growth.
    const end = { x: handleCenter.x + 80 * zoom, y: handleCenter.y + 60 * zoom };

    const startState = await resizeState(page);
    await touchStart(page, handleCenter);
    // The gesture must KEEP tracking across re-renders: measure mid-gesture,
    // after several moves, before touchend. The old bug killed the touch
    // gesture after the first move (React re-render re-bound d3-drag), so
    // only the first few px applied. With StableNodeResizer the wrapper
    // (`.react-flow__node` width, in flow px) grows monotonically with the
    // drag, and onResize makes the node's own box follow the finger.
    let lastWrapper = startState.wrapper;
    let lastInner = startState.inner;
    for (let i = 1; i <= 6; i += 1) {
      const dx = ((end.x - handleCenter.x) * i) / 6;
      const dy = ((end.y - handleCenter.y) * i) / 6;
      await touchMove(page, handleCenter.x + dx, handleCenter.y + dy);
      await page.waitForTimeout(120);
      const st = await resizeState(page);
      expect(st.wrapper).toBeGreaterThan(lastWrapper);
      expect(st.inner).toBeGreaterThan(lastInner);
      lastWrapper = st.wrapper;
      lastInner = st.inner;
    }
    // Full drag tracked: the wrapper grew by roughly the flow delta (~80px)
    // and the node's own box followed live (inner grew). A gesture killed by
    // the re-render rebind stays near the first move's ~13px.
    expect(lastWrapper - startState.wrapper).toBeGreaterThanOrEqual(40);
    expect(lastInner - startState.inner).toBeGreaterThanOrEqual(30);

    await touchEnd(page, end.x, end.y);
    await page.waitForTimeout(400);
  });

  test("desktop mouse drag on the same handle still resizes (regression)", async ({ adminPage }) => {
    const page = adminPage;
    await loadTablesPage(page);
    const node = page.locator(TABLE_NODE).first();
    await enterEditMode(page);

    await selectFirstTable(page);
    const handle = node.locator(BR_HANDLE).first();
    await expect(handle).toBeVisible({ timeout: 10_000 });

    const h = await centerOf(handle);
    const startState = await resizeState(page);
    await page.mouse.move(h.x, h.y);
    await page.mouse.down();
    let lastWrapper = startState.wrapper;
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(h.x + (90 * i) / 8, h.y + (70 * i) / 8, { steps: 2 });
      await page.waitForTimeout(80);
      const st = await resizeState(page);
      expect(st.wrapper).toBeGreaterThan(lastWrapper);
      lastWrapper = st.wrapper;
    }
    expect(lastWrapper - startState.wrapper).toBeGreaterThanOrEqual(40);
    await page.mouse.up();
    await page.waitForTimeout(400);
  });
});
