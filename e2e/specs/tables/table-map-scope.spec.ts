import { test, expect } from "../../fixtures/session";
import type { Page } from "@playwright/test";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Real-app E2E coverage for the table-map scope persistence.
 *
 * The scope toggle (data-ui="template-scope-toggle") is a global control for
 * ALL map edits (table positions, draw elements, limit area), not just the
 * limit drawing:
 *
 *   - scope "template" (Cambios en la plantilla): table positions are saved
 *     into the cross-day template table_positions and draw elements into
 *     draw_elements_template -> visible on every date of the floor.
 *   - scope "day" (Cambios solo este dia): table positions + elements are
 *     saved into the per-day layout only; the template stays untouched.
 *
 * Tables and draw elements may only be grabbed/dragged in edit mode.
 *
 * Dates here are dedicated fixtures (2026-04-07/08) so the existing
 * template spec (2026-04-05) is never clobbered. Every test cleans the
 * floor template first.
 */

const DATE1 = "2026-04-07";
const DATE2 = "2026-04-08";
const FLOOR = 0;

const MAP_PAGE = '[data-ui="table-map-page"]';
const PICKER_BTN = '[data-testid="table-map-date-picker"]';
const FLOW_WRAP = '[data-ui="flow-wrapper"]';
const EDITOR_TOGGLE = '[data-ui="edit-mode-toggle"]';
const SCOPE_TOGGLE = '[data-ui="template-scope-toggle"]';
const SCOPE_TEMPLATE_BTN = '[data-ui="template-scope-template-btn"]';
const SCOPE_DAY_BTN = '[data-ui="template-scope-day-btn"]';
const LIMIT_SECTION = '[data-ui="limit-section"]';
const SELECT_TOOL_BTN = '[aria-label="Seleccionar (cursor)"]';
const TEMPLATE_STATUS = '[data-ui="template-status"]';

type FlowPoint = { x: number; y: number };

async function loadMap(page: Page, dateISO: string) {
  await page.goto(`/app/reservas/tables?date=${dateISO}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
  await expect(page.locator(PICKER_BTN)).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(FLOW_WRAP).first()).toBeVisible({ timeout: 15_000 });
}

async function ensureEditMode(page: Page) {
  const toggle = page.locator(EDITOR_TOGGLE);
  if ((await toggle.count()) === 0) return;
  if ((await toggle.first().getAttribute("aria-checked")) !== "true") {
    await toggle.first().click({ force: true });
  }
}

async function useSelectTool(page: Page) {
  const btn = page.locator(SELECT_TOOL_BTN);
  if ((await btn.count()) > 0) {
    await btn.first().click();
  }
}

/** Node position in FLOW coordinates (viewport-independent). */
async function nodeFlowPosition(page: Page, nodeId: string): Promise<FlowPoint> {
  return page.locator(`[data-id="${nodeId}"]`).evaluate((el) => {
    const t = (el as HTMLElement).style.transform || "";
    const m = t.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
    return { x: m ? Number(m[1]) : NaN, y: m ? Number(m[2]) : NaN };
  });
}

/** Drag a node by a screen-space delta (converted through current zoom by the browser). */
async function dragNode(page: Page, nodeId: string, dxScreen: number, dyScreen: number) {
  const node = page.locator(`[data-id="${nodeId}"]`);
  await expect(node).toBeVisible();
  const box = await node.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + dxScreen, box!.y + box!.height / 2 + dyScreen, {
    steps: 16,
    delay: 25,
  } as Parameters<typeof page.mouse.move>[2]);
  await page.mouse.up();
}

async function clearTemplate(api: { delete: (path: string) => Promise<unknown> }) {
  await api.delete(`/api/admin/tables/template/${FLOOR}`).catch(() => undefined);
}

/** Wipe per-day overrides/state for the fixture date so serial re-runs are deterministic. */
async function resetDayLayout(api: {
  put: (path: string, body: Record<string, unknown>) => Promise<unknown>;
}) {
  await api
    .put("/api/admin/tables", {
      entity: "layout",
      date: DATE1,
      floor_number: FLOOR,
      metadata: {
        _template_scope: null,
        _table_positions_override: null,
        _limit_area_template_points_override: null,
        _draw_elements_template_override: null,
        table_positions: null,
        elements: null,
        limit_points: null,
        booking_states: null,
      },
    })
    .catch(() => undefined);
}

type SeedOptions = {
  tablePositions?: boolean;
  drawElements?: boolean;
};

/**
 * Seeds a floor template with a closed limit polygon that wraps every table,
 * optional per-table positions and an optional draw element. All tables get
 * a distinct grid position so node drags can never grab a hidden stacked
 * sibling. Returns the ids used by the assertions.
 */
async function seedTemplate(
  page: Page,
  api: {
    get: <T = unknown>(path: string) => Promise<T>;
    post: (path: string, body: Record<string, unknown>) => Promise<unknown>;
  },
  opts: SeedOptions = {},
) {
  const list = (await api.get(`/api/admin/tables?date=${DATE1}&floor_number=${FLOOR}`)) as {
    tables?: Array<{ id: number; x_pos?: number; y_pos?: number }>;
  };
  const tables = (list.tables || []).filter((t) => Number(t.id) > 0);
  expect(tables.length).toBeGreaterThan(0);
  const SPACING = 220;
  const positions: Record<string, unknown> = {};
  let maxX = 0;
  tables.forEach((t, idx) => {
    positions[String(t.id)] = { x_pos: idx * SPACING, y_pos: 0 };
    maxX = Math.max(maxX, idx * SPACING);
  });
  const cx = 0;
  const cy = 0;
  const P = 2000;
  const limit_area_template_points = [
    { x: cx - P, y: cy - P },
    { x: maxX + P, y: cy - P },
    { x: maxX + P, y: cy + P },
    { x: cx - P, y: cy + P },
  ];
  const data: Record<string, unknown> = {
    limit_area_template_points,
  };
  if (opts.tablePositions) {
    data.table_positions = positions;
  }
  if (opts.drawElements) {
    data.draw_elements_template = [
      {
        id: "plant-e2e-1",
        kind: "obstacle",
        preset: "plant",
        display_mode: "both",
        x: cx + 120,
        y: cy + 220,
        width: 92,
        height: 92,
        rotationDeg: 0,
        label: "E2E plant",
      },
    ];
  }
  const res = (await api.post(`/api/admin/tables/template/${FLOOR}`, { data })) as {
    success?: boolean;
  };
  expect(res.success, "template seed failed").toBe(true);
  return { firstTableId: Number(tables[0].id), cx, cy };
}

async function getTemplate(api: {
  get: <T = unknown>(path: string) => Promise<T>;
}): Promise<Record<string, unknown>> {
  const res = (await api.get(`/api/admin/tables/template/${FLOOR}`)) as {
    template?: Record<string, unknown>;
  };
  return (res.template || {}) as Record<string, unknown>;
}

async function getDayLayout(api: {
  get: <T = unknown>(path: string) => Promise<T>;
}, dateISO: string): Promise<Record<string, unknown>> {
  const res = (await api.get(`/api/admin/tables?date=${dateISO}&floor_number=${FLOOR}`)) as {
    layout?: { map?: Record<string, unknown> };
  };
  return ((res.layout || {}).map || {}) as Record<string, unknown>;
}

function templatePos(tpl: Record<string, unknown>, id: number) {
  const table_positions = (tpl.table_positions || {}) as Record<string, unknown>;
  const entry = (table_positions[String(id)] || {}) as Record<string, number>;
  return { x: entry.x_pos, y: entry.y_pos };
}

function dayPos(layout: Record<string, unknown>, id: number) {
  const table_positions = (layout.table_positions || {}) as Record<string, unknown>;
  const entry = (table_positions[String(id)] || {}) as Record<string, number>;
  return { x: entry.x_pos, y: entry.y_pos };
}

function dayElements(layout: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = layout.elements;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

function templateElements(tpl: Record<string, unknown>): Array<Record<string, unknown>> {
  const raw = tpl.draw_elements_template;
  return Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
}

async function reloadMap(page: Page) {
  await page.reload();
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
  await expect(page.locator(FLOW_WRAP).first()).toBeVisible({ timeout: 15_000 });
}

test.describe("Tables Map - Scope Persistence (edit mode gating + template/day)", () => {
  test.describe.configure({ mode: "serial", retries: 2 });

  test.afterAll(async ({ api }) => {
    // Leave the shared floor template clean: other table specs assert the
    // toggle is hidden when no template exists.
    await clearTemplate(api).catch(() => undefined);
  });

  test.beforeEach(async ({ adminPage, api }) => {
    // The map only renders for open days; force both fixture dates open.
    for (const d of [DATE1, DATE2]) {
      await api.post(`/api/admin/config/day`, { date: d, isOpen: true }).catch(() => undefined);
    }
    await loadMap(adminPage, DATE1);
    await resetDayLayout(api);
    await clearTemplate(api);
  });

  test("view mode blocks table grab/drag: position stays on template value", async ({ adminPage, api }) => {
    const { firstTableId } = await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);

    const before = await nodeFlowPosition(adminPage, String(firstTableId));
    expect(before.x, "template position must be seeded").toBeGreaterThanOrEqual(0);

    await dragNode(adminPage, String(firstTableId), 90, 90);
    await adminPage.waitForTimeout(1200);

    const after = await nodeFlowPosition(adminPage, String(firstTableId));
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);

    // Reload must show the template position (nothing was persisted).
    await reloadMap(adminPage);
    const tpl = await getTemplate(api);
    const tplPos = templatePos(tpl, firstTableId);
    expect(tplPos.x).toBe(before.x);
    expect(tplPos.y).toBe(before.y);
  });

  test("edit mode allows table drag and persists to the day layout", async ({ adminPage, api }) => {
    const { firstTableId: id } = await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);
    // The seeded template makes "template" the default scope; this test
    // exercises the day path, so flip the toggle explicitly.
    if ((await adminPage.locator(SCOPE_DAY_BTN).count()) > 0) {
      await adminPage.locator(SCOPE_DAY_BTN).first().click();
      await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
    }

    await dragNode(adminPage, String(id), 90, 90);
    await adminPage.waitForTimeout(1200);

    const layout = await getDayLayout(api, DATE1);
    const pos = dayPos(layout, id);
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(Math.abs(pos.x - 0) + Math.abs(pos.y - 0)).toBeGreaterThan(1);

    // Day layout holds the position after reload.
    await reloadMap(adminPage);
    const node = adminPage.locator(`[data-id="${id}"]`);
    await expect(node).toBeVisible();
    const after = await nodeFlowPosition(adminPage, String(id));
    expect(Math.abs(after.x - pos.x)).toBeLessThan(1);
    expect(Math.abs(after.y - pos.y)).toBeLessThan(1);
  });

  test("scope toggle lives outside the limit section and inside the draw panel", async ({ adminPage, api }) => {
    await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);

    await expect(adminPage.locator(SCOPE_TOGGLE)).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(`${LIMIT_SECTION} ${SCOPE_TOGGLE}`)).toHaveCount(0);
    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "true");
    await expect(adminPage.locator(TEMPLATE_STATUS)).toHaveText(/Plantilla/);
  });

  test("template scope: table drag updates the template and shows on another date", async ({ adminPage, api }) => {
    const { firstTableId, cx, cy } = await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);

    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "true");

    await dragNode(adminPage, String(firstTableId), 90, 90);
    await adminPage.waitForTimeout(1500);

    const tpl = await getTemplate(api);
    const tplPos = templatePos(tpl, firstTableId);
    expect(tplPos.x).not.toBe(cx);
    expect(tplPos.y).not.toBe(cy);

    // The other date renders the same template position.
    const date2 = (await api.get(`/api/admin/tables?date=${DATE2}&floor_number=${FLOOR}`)) as {
      tables?: Array<{ id: number; x_pos?: number; y_pos?: number }>;
    };
    const t2 = (date2.tables || []).find((t) => Number(t.id) === firstTableId);
    expect(t2).toBeTruthy();
    expect(Number(t2!.x_pos)).toBe(tplPos.x);
    expect(Number(t2!.y_pos)).toBe(tplPos.y);
  });

  test("day scope: table drag updates only the day layout; template untouched", async ({ adminPage, api }) => {
    const { firstTableId } = await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);

    await adminPage.locator(SCOPE_DAY_BTN).first().click();
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });

    const tplBefore = await getTemplate(api);
    const beforeTpl = templatePos(tplBefore, firstTableId);

    await dragNode(adminPage, String(firstTableId), 80, 80);
    await adminPage.waitForTimeout(1500);

    const tplAfter = await getTemplate(api);
    expect(templatePos(tplAfter, firstTableId).x).toBe(beforeTpl.x);
    expect(templatePos(tplAfter, firstTableId).y).toBe(beforeTpl.y);

    const layout = await getDayLayout(api, DATE1);
    const pos = dayPos(layout, firstTableId);
    expect(Math.abs(pos.x - beforeTpl.x) + Math.abs(pos.y - beforeTpl.y)).toBeGreaterThan(1);

    // Reload: day scope survives (snapshot scope = "day") and the per-day
    // position is what renders.
    await reloadMap(adminPage);
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
    const node = adminPage.locator(`[data-id="${firstTableId}"]`);
    await expect(node).toBeVisible();
    const after = await nodeFlowPosition(adminPage, String(firstTableId));
    expect(Math.abs(after.x - pos.x)).toBeLessThan(1);
    expect(Math.abs(after.y - pos.y)).toBeLessThan(1);
  });

  test("switching back to template scope restores template positions and clears day shadow keys", async ({ adminPage, api }) => {
    const { firstTableId } = await seedTemplate(adminPage, api, { tablePositions: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);

    // Move the table while in day scope: only the day layout changes.
    await adminPage.locator(SCOPE_DAY_BTN).first().click();
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });
    await dragNode(adminPage, String(firstTableId), 80, 80);
    await adminPage.waitForTimeout(1500);

    // Back to template scope: the template position must render again and
    // the per-day shadow keys (elements/limit_points/table_positions) must
    // be gone so they can never shadow the template.
    await adminPage.locator(SCOPE_TEMPLATE_BTN).first().click();
    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });

    const tpl = await getTemplate(api);
    const tplPos = templatePos(tpl, firstTableId);
    // The GET returns the merged view: per-day-only shadow keys must be gone
    // (elements/limit_points/_template_scope) and table_positions now comes
    // from the template (the per-day copy was cleared).
    const layout = await getDayLayout(api, DATE1);
    expect(layout.elements).toBeFalsy();
    expect(layout.limit_points).toBeFalsy();
    expect(layout._template_scope).toBeFalsy();

    const node = adminPage.locator(`[data-id="${firstTableId}"]`);
    await expect(node).toBeVisible();
    const after = await nodeFlowPosition(adminPage, String(firstTableId));
    expect(Math.abs(after.x - tplPos.x)).toBeLessThan(1);
    expect(Math.abs(after.y - tplPos.y)).toBeLessThan(1);
  });

  test("template scope: draw element drag updates draw_elements_template", async ({ adminPage, api }) => {
    await seedTemplate(adminPage, api, { tablePositions: true, drawElements: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);

    await expect(adminPage.locator(SCOPE_TEMPLATE_BTN)).toHaveAttribute("aria-pressed", "true");
    const elementId = "plant-e2e-1";
    await expect(adminPage.locator(`[data-id="${elementId}"]`)).toBeVisible();

    const before = await nodeFlowPosition(adminPage, elementId);
    await dragNode(adminPage, elementId, 70, 70);
    await adminPage.waitForTimeout(1500);

    const tpl = await getTemplate(api);
    const elements = templateElements(tpl);
    const el = elements.find((e) => e.id === elementId);
    expect(el, "element must live in the template").toBeTruthy();
    expect(Math.abs(Number(el!.x) - before.x)).toBeGreaterThan(1);
    expect(Math.abs(Number(el!.y) - before.y)).toBeGreaterThan(1);
  });

  test("day scope: draw element drag updates only the day layout", async ({ adminPage, api }) => {
    await seedTemplate(adminPage, api, { tablePositions: true, drawElements: true });
    await reloadMap(adminPage);
    await useSelectTool(adminPage);
    await ensureEditMode(adminPage);

    await adminPage.locator(SCOPE_DAY_BTN).first().click();
    await expect(adminPage.locator(SCOPE_DAY_BTN)).toHaveAttribute("aria-pressed", "true", { timeout: 10_000 });

    const tplBefore = await getTemplate(api);
    const elBefore = templateElements(tplBefore).find((e) => e.id === "plant-e2e-1");
    expect(elBefore).toBeTruthy();

    const elementId = "plant-e2e-1";
    await dragNode(adminPage, elementId, 60, 60);
    await adminPage.waitForTimeout(1500);

    const tplAfter = await getTemplate(api);
    const elTpl = templateElements(tplAfter).find((e) => e.id === elementId);
    expect(elTpl!.x).toBe(elBefore!.x);
    expect(elTpl!.y).toBe(elBefore!.y);

    const layout = await getDayLayout(api, DATE1);
    const elDay = dayElements(layout).find((e) => e.id === elementId);
    expect(elDay, "element must live in the day layout").toBeTruthy();
    expect(Math.abs(Number(elDay!.x) - Number(elBefore!.x))).toBeGreaterThan(1);
  });
});
