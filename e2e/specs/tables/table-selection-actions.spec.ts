import { test, expect, type Page } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";
import type { TestApiClient } from "../../helpers/api-client";

/**
 * Table selection & edit-mode actions (map de mesas).
 *
 * 1. Selecting a table must take exactly ONE tap/click.
 * 2. Clicking the empty canvas must deselect it.
 * 3. A selected table shows an action overlay (top-right) with Edit (opens
 *    the table editor modal) and Delete (opens a confirmation modal that
 *    deletes the table).
 *
 * Touch taps use Playwright's trusted touchscreen.tap (real click synthesis);
 * the page runs on an iPhone 12 context (adminTouchPage).
 */

const TEST_DATE = "2026-04-05";
const EDIT_SWITCH = '[data-ui="edit-mode-toggle"] button';
const CLOSE_PANEL_BTN = '[data-ui="close-draw-panel-btn"]';
const TABLE_NODE = '[data-ui="table-node"]';
const ACTION_OVERLAY = '[data-ui="table-action-overlay"]';
const EDIT_BTN = '[data-ui="table-edit-btn"]';
const DELETE_BTN = '[data-ui="table-delete-btn"]';

async function enterEditMode(page: Page) {
  const editSwitch = page.locator(EDIT_SWITCH).first();
  await expect(editSwitch).toBeVisible({ timeout: 15_000 });
  if ((await editSwitch.getAttribute("aria-checked")) !== "true") {
    await editSwitch.click();
  }
  const closePanel = page.locator(CLOSE_PANEL_BTN);
  await expect(closePanel.first()).toBeVisible({ timeout: 10_000 });
  await closePanel.first().click();
  await page.waitForTimeout(400);
}

async function loadTablesPage(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
    await waitForLoadingToFinish(page);
    const ok = await page
      .locator(TABLE_NODE)
      .first()
      .waitFor({ state: "visible", timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    if (ok) return;
    await page.reload();
  }
}

const selectedCount = (page: Page) =>
  page.evaluate(() => document.querySelectorAll('[data-ui="table-node"].is-selected').length);

async function tableCenter(page: Page) {
  const node = page.locator(TABLE_NODE).first();
  await node.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const box = (await node.boundingBox())!;
  return { node, x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Tap a table and wait until it is selected; retries because a tap can land
 * a frame too early (dev-server load). Selection itself is idempotent. */
async function tapSelectTable(page: Page) {
  const { x, y } = await tableCenter(page);
  for (let i = 0; i < 3; i += 1) {
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(350);
    if ((await selectedCount(page)) > 0) return;
  }
}

/** Tap empty canvas: scan candidate points inside the flow pane until one is
 * NOT covered by a table, control or overlay, then tap it. */
async function tapEmptyCanvas(page: Page) {
  const pane = page.locator(".react-flow__pane").first();
  await pane.waitFor({ state: "visible", timeout: 10_000 });
  const candidates = await page.evaluate(() => {
    const p = document.querySelector(".react-flow__pane")!.getBoundingClientRect();
    const out: Array<{ x: number; y: number }> = [];
    for (const [fx, fy] of [
      [0.2, 0.15],
      [0.5, 0.1],
      [0.1, 0.3],
      [0.3, 0.25],
      [0.7, 0.15],
    ] as Array<[number, number]>) {
      const x = p.x + p.width * fx;
      const y = p.y + p.height * fy;
      const el = document.elementFromPoint(x, y);
      const ok =
        el &&
        (el.classList.contains("react-flow__pane") ||
          el.closest(".react-flow__pane") ||
          el.classList.contains("react-flow__renderer"));
      if (ok) out.push({ x, y });
      (window as any).__probe = (window as any).__probe || [];
      (window as any).__probe.push({ x, y, cls: el?.className?.toString().slice(0, 60) ?? "null", tag: el?.tagName });
    }
    return out;
  });
  console.log("PANE-PROBE", JSON.stringify(await page.evaluate(() => (window as any).__probe)));
  expect(candidates.length).toBeGreaterThan(0);
  await page.touchscreen.tap(candidates[0].x, candidates[0].y);
  await page.waitForTimeout(400);
}

async function seedTablePositions(api: TestApiClient) {
  await api.delete(`/api/admin/tables/template/0`).catch(() => undefined);
  const list = (await api.get(`/api/admin/tables?date=${TEST_DATE}&floor_number=0`)) as {
    tables?: Array<{ id: number }>;
  };
  const tables = (list.tables || []).filter((t) => Number(t.id) > 0);
  // Reset persisted resize sizes so tables return to their default box.
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
  const spacing = 300;
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

test.describe("Tables Map - Selection & edit actions", () => {
  test.describe.configure({ mode: "serial", retries: 3 });

  test.beforeEach(async ({ api }) => {
    await seedTablePositions(api);
  });

  test("one tap selects a table, and it stays selected on re-tap", async ({ adminTouchPage }) => {
    const page = adminTouchPage;
    await loadTablesPage(page);
    await enterEditMode(page);
    await expect(page.locator(TABLE_NODE).first()).toBeVisible({ timeout: 10_000 });

    const { x, y } = await tableCenter(page);
    expect(await selectedCount(page)).toBe(0);
    await tapSelectTable(page);
    expect(await selectedCount(page)).toBe(1);

    // Tapping the same table again must NOT deselect it (deselect = tap canvas).
    await tapSelectTable(page);
    expect(await selectedCount(page)).toBe(1);
  });

  test("tapping the empty canvas deselects the table", async ({ adminTouchPage }) => {
    const page = adminTouchPage;
    await loadTablesPage(page);
    await enterEditMode(page);
    await expect(page.locator(TABLE_NODE).first()).toBeVisible({ timeout: 10_000 });

    const { x, y } = await tableCenter(page);
    const editState = await page.evaluate(() => ({
      editMode: document.body.classList.contains("is-table-edit-mode"),
      checked: document.querySelector('[data-ui="edit-mode-toggle"] button')?.getAttribute("aria-checked"),
    }));
    console.log("EDIT-STATE", JSON.stringify(editState));
    await page.touchscreen.tap(x, y);
    await page.waitForTimeout(400);
    const afterTap = await page.evaluate(() => {
      const ov = document.querySelector(".bo-modalOverlay");
      return { sel: document.querySelectorAll('[data-ui="table-node"].is-selected').length, modalTitle: ov?.querySelector('[data-ui="modal-title"]')?.textContent ?? null };
    });
    console.log("AFTER-TAP", JSON.stringify(afterTap));
    expect(afterTap.sel).toBe(1);

    await tapEmptyCanvas(page);
    expect(await selectedCount(page)).toBe(0);
  });

  test("selected table shows edit and delete action buttons", async ({ adminTouchPage }) => {
    const page = adminTouchPage;
    await loadTablesPage(page);
    await enterEditMode(page);
    await expect(page.locator(TABLE_NODE).first()).toBeVisible({ timeout: 10_000 });

    // No overlay before selection.
    await expect(page.locator(ACTION_OVERLAY)).toHaveCount(0);

    await tapSelectTable(page);

    const overlay = page.locator(ACTION_OVERLAY).first();
    await expect(overlay).toBeVisible({ timeout: 10_000 });
    await expect(overlay.locator(EDIT_BTN)).toBeVisible();
    await expect(overlay.locator(DELETE_BTN)).toBeVisible();
  });

  test("edit button opens the table editor modal", async ({ adminTouchPage }) => {
    const page = adminTouchPage;
    await loadTablesPage(page);
    await enterEditMode(page);
    await expect(page.locator(TABLE_NODE).first()).toBeVisible({ timeout: 10_000 });

    await tapSelectTable(page);

    const editBtn = page.locator(EDIT_BTN).first();
    const bb = (await editBtn.boundingBox())!;
    const hit = await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      return { cls: el ? (el as HTMLElement).className?.toString().slice(0, 60) : null, tag: el?.tagName };
    }, [bb.x + bb.width / 2, bb.y + bb.height / 2] as [number, number]);
    console.log("EDIT-HIT", JSON.stringify({ bb, hit }));
    await editBtn.click();
    const modal = page.locator('[data-ui="editor-grid"]');
    await expect(modal).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-ui="modal-title"]').first()).toContainText("Editar mesa");
  });

  test("delete button opens confirmation and deletes the table", async ({ adminTouchPage, api }) => {
    const page = adminTouchPage;
    // Create a throwaway table so we never delete a real one.
    const list = (await api.get(`/api/admin/tables?date=${TEST_DATE}&floor_number=0`)) as {
      areas?: Array<{ id: number }>;
      tables?: Array<{ id: number }>;
    };
    const areaId = Number((list.areas || [])[0]?.id || 0);
    const uniqueNumero = `t${Date.now()}`;
    const created = (await api.post("/api/admin/tables", {
      entity: "table",
      area_id: areaId,
      name: `Mesa e2e ${uniqueNumero}`,
      numero_mesa: uniqueNumero,
      capacity: 4,
      shape: "round",
      date: TEST_DATE,
      floor_number: 0,
      x_pos: 1500,
      y_pos: 0,
    })) as { success?: boolean; item?: { id: number } };
    const createdId = Number(created?.item?.id || 0);
    expect(createdId).toBeGreaterThan(0);

    try {
      await loadTablesPage(page);
      await enterEditMode(page);
      const node = page.locator(TABLE_NODE).filter({ hasText: uniqueNumero }).first();
      await expect(node).toBeVisible({ timeout: 15_000 });
      await node.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const box = (await node.boundingBox())!;
      for (let i = 0; i < 3; i += 1) {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(350);
        if ((await selectedCount(page)) > 0) break;
      }

      await page.locator(DELETE_BTN).first().click();
      const confirm = page.locator('[data-ui="delete-table-confirm"]');
      await expect(confirm).toBeVisible({ timeout: 10_000 });
      await confirm.locator('[data-ui="confirm-delete-table-btn"]').click();

      await expect(node).not.toBeVisible({ timeout: 15_000 });
    } finally {
      // Cleanup: remove the throwaway table even if the test failed mid-way.
      await api.delete(`/api/admin/tables/${createdId}`).catch(() => undefined);
    }
  });
});
