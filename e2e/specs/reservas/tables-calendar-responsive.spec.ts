import { test, expect, type Page } from "@playwright/test";
import { e2eEnv } from "../../config";
import { login } from "../../helpers/auth";

/**
 * Responsive layout contract for the table-map date calendar.
 *
 * Covers three requirements:
 *  1. Date cells stay square and never collide at any width.
 *  2. Corner date cells are not cut by their rounded-corner container.
 *  3. The calendar popover is ~1:1 square, capped at 95vw, never overflows.
 *
 * Tests are viewport-driven: each runs at several widths in one browser
 * context so layout is measured, not just asserted, at the breakpoints where
 * the bugs appeared (desktop → 320px).
 */

const ROUTE = "/app/reservas/tables";
const POPOVER = '[data-ui="date-picker-popover"]';
const POPOVER_CELLS = `${POPOVER} [data-slot="month-calendar-day-cell"]`;
const INLINE_CAL = '[data-ui="calendar-wrapper"] [data-testid="month-calendar"]';
const INLINE_CELLS = '[data-ui="calendar-wrapper"] [data-slot="month-calendar-day-cell"]';

const WIDTHS = [1280, 1024, 768, 390, 360, 320];

type CellRect = { l: number; t: number; r: number; b: number; w: number; h: number };

/** Min measured gap (px) between same-row neighbours (h) and between rows (v).
 *  Guards the "cells must not touch" requirement: a responsive gap keeps visible
 *  separation at every width. */
function minGaps(cells: CellRect[]): { h: number; v: number } {
  if (cells.length < 2) return { h: Infinity, v: Infinity };
  let h = Infinity, v = Infinity;
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1], b = cells[i];
    if (Math.abs(a.t - b.t) < 2) h = Math.min(h, b.l - a.r);          // same row
    else v = Math.min(v, b.t - cells[i - 1].b);                        // new row
  }
  return { h, v };
}
type PopGeom = {
  pop: { w: number; h: number; l: number; r: number };
  ratio: number | null;
  vw: number;
  cells: CellRect[];
  minHGap: number;
  minVGap: number;
};

async function openTablesAt(page: Page, width: number, height: number) {
  await page.goto(`${e2eEnv.baseURL}${ROUTE}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.locator('[data-testid="table-map-date-picker"]').first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);
}

async function openPopover(page: Page) {
  await page.locator('[data-testid="table-map-date-picker"]').first().click();
  await page.waitForSelector(POPOVER, { timeout: 10_000 });
  await page.waitForTimeout(300); // layout settle
}

async function measurePopover(page: Page): Promise<PopGeom> {
  const raw = await page.evaluate((sel) => {
    const pop = document.querySelector(sel)!;
    const pr = pop.getBoundingClientRect();
    const cells = [...document.querySelectorAll(`${sel} [data-slot="month-calendar-day-cell"]`)].map((c) => {
      const r = (c as HTMLElement).getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    });
    let gh = Infinity, gv = Infinity;
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1], b = cells[i];
      if (Math.abs(a.t - b.t) < 2) gh = Math.min(gh, b.l - a.r);
      else gv = Math.min(gv, b.t - a.b);
    }
    return {
      pop: { w: pr.width, h: pr.height, l: pr.left, r: pr.right },
      ratio: pr.height ? pr.width / pr.height : null,
      vw: window.innerWidth,
      cells,
      gh, gv,
    };
  }, POPOVER);
  return { ...raw, minHGap: raw.gh, minVGap: raw.gv };
}

type InlineGeom = {
  wrap: { w: number; h: number; radius: string; overflow: string };
  cells: CellRect[];
  collisions: number;
  clipped: number;
  minHGap: number;
  minVGap: number;
};

async function measureInline(page: Page): Promise<InlineGeom> {
  return page.evaluate((sel) => {
    const wrap = document.querySelector('[data-ui="calendar-wrapper"]')!;
    const wr = wrap.getBoundingClientRect();
    const ws = getComputedStyle(wrap);
    const cells = [...document.querySelectorAll(sel)].map((c) => {
      const r = (c as HTMLElement).getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    });
    // collisions: consecutive same-row cells overlapping horizontally
    let collisions = 0;
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1], b = cells[i];
      if (Math.abs(a.t - b.t) < 2 && b.l < a.r - 1) collisions++;
    }
    // clipped: any cell rect outside the wrapper content box
    const pL = parseFloat(ws.paddingLeft) || 0, pR = parseFloat(ws.paddingRight) || 0;
    const pT = parseFloat(ws.paddingTop) || 0, pB = parseFloat(ws.paddingBottom) || 0;
    const cL = wr.left + pL, cR = wr.right - pR, cT = wr.top + pT, cB = wr.bottom - pB;
    const clipped = cells.filter((c) => c.l < cL - 0.5 || c.r > cR + 0.5 || c.t < cT - 0.5 || c.b > cB + 0.5).length;
    let gh = Infinity, gv = Infinity;
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1], b = cells[i];
      if (Math.abs(a.t - b.t) < 2) gh = Math.min(gh, b.l - a.r);
      else gv = Math.min(gv, b.t - a.b);
    }
    return {
      wrap: { w: wr.width, h: wr.height, radius: ws.borderRadius, overflow: ws.overflow },
      cells,
      collisions,
      clipped,
      minHGap: gh,
      minVGap: gv,
    };
  }, INLINE_CELLS);
}

/** Scan ~2 months around today for the first admin-open day (ISO).
 *  The inline calendar only renders in the open-day view, so the inline tests
 *  need a real open day. Throws (rather than silently falling back to a closed
 *  today) so a missing open day surfaces as a clear failure, not a timeout. */
async function findOpenDate(page: Page): Promise<string> {
  const found = await page.evaluate(async () => {
    const iso = (off: number) => {
      const d = new Date();
      d.setDate(d.getDate() + off);
      return d.toISOString().slice(0, 10);
    };
    for (let off = -5; off <= 60; off++) {
      const date = iso(off);
      try {
        const r = await fetch(`/api/admin/config/day?date=${date}`, { credentials: "include" });
        const j = await r.json();
        if (j.isOpen) return date;
      } catch { /* keep scanning */ }
    }
    return null;
  });
  if (!found) throw new Error("No open day found in today-5..today+60; cannot test inline calendar");
  return found;
}

/** Click the open-day cell inside the popover, navigating months if needed.
 *  openDate comes from findOpenDate (near today), so a short bidirectional
 *  search is enough — no need to parse the localized month header. */
async function pickOpenDate(page: Page, openDate: string) {
  const cellAt = () => page.locator(`${POPOVER} button[data-date="${openDate}"]`);
  if (await cellAt().count()) { await cellAt().click(); return; }
  for (let i = 0; i < 3; i++) {
    await page.locator(`${POPOVER} [data-testid="month-calendar-prev"]`).click();
    await page.waitForTimeout(150);
    if (await cellAt().count()) { await cellAt().click(); return; }
  }
  for (let i = 0; i < 6; i++) {
    await page.locator(`${POPOVER} [data-testid="month-calendar-next"]`).click();
    await page.waitForTimeout(150);
    if (await cellAt().count()) { await cellAt().click(); return; }
  }
  throw new Error(`Could not navigate popover to open date ${openDate}`);
}

async function revealInlineCalendar(page: Page) {
  const openBtn = page.locator('[data-ui="open-right-panel-btn"]').first();
  if (await openBtn.count()) { await openBtn.click(); await page.waitForTimeout(400); }
  const toggle = page.locator('[data-ui="date-toggle-btn"]').first();
  await expect(toggle).toBeVisible({ timeout: 8_000 });
  await toggle.click();
  await page.waitForSelector(INLINE_CAL, { timeout: 8_000 });
  await page.waitForTimeout(300);
}

// Shared geometry assertions ------------------------------------------------

function expectNoCollisionOrClip(cells: CellRect[], ctx: { w: number; h: number }) {
  expect(cells.length, "calendar should render day cells").toBeGreaterThan(0);
  // square cells
  for (const c of cells) {
    expect(Math.abs(c.w - c.h), `cell squareness at ${ctx.w} (w=${c.w.toFixed(1)} h=${c.h.toFixed(1)})`).toBeLessThanOrEqual(3);
  }
  // no horizontal collision between same-row neighbours
  let collisions = 0;
  for (let i = 1; i < cells.length; i++) {
    const a = cells[i - 1], b = cells[i];
    if (Math.abs(a.t - b.t) < 2 && b.l < a.r - 1) collisions++;
  }
  expect(collisions, `no cell collisions at ${ctx.w}`).toBe(0);
  void ctx;
}

// Tests ---------------------------------------------------------------------

test.describe("table-map calendar responsive layout", () => {
  test.describe.configure({ mode: "serial" });

  for (const w of WIDTHS) {
    test(`popover is square, ≤95vw, no overflow, square cells @ ${w}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      try {
        await login(page, { baseURL: e2eEnv.baseURL, email: e2eEnv.adminEmail, password: e2eEnv.adminPassword });
        await openTablesAt(page, w, 900);
        await openPopover(page);
        const g = await measurePopover(page);

        // (3a) max-width 95vw
        expect(g.pop.w, `popover width ≤95vw at ${w}`).toBeLessThanOrEqual(0.95 * g.vw + 1);
        // (3b) no horizontal overflow
        expect(g.pop.r, `popover right ≤ viewport at ${w}`).toBeLessThanOrEqual(g.vw);
        expect(g.pop.l, `popover left ≥ 0 at ${w}`).toBeGreaterThanOrEqual(0);
        // (3c) ~1:1 square (tolerance for 6-row months)
        expect(g.ratio, `popover ~1:1 ratio at ${w}`).toBeGreaterThan(0.85);
        expect(g.ratio, `popover ~1:1 ratio at ${w}`).toBeLessThan(1.2);
        // (1) square cells, no collision
        expectNoCollisionOrClip(g.cells, { w, h: 900 });
        // (1b) cells never touch — responsive gap keeps visible separation
        expect(g.minHGap, `popover min horizontal gap ≥3px at ${w}`).toBeGreaterThanOrEqual(3);
        expect(g.minVGap, `popover min vertical gap ≥3px at ${w}`).toBeGreaterThanOrEqual(3);
      } finally {
        await ctx.close();
      }
    });
  }

  for (const w of [1280, 768, 390, 360, 320]) {
    test(`inline calendar: no corner clip, square cells, no collision @ ${w}px`, async ({ browser }) => {
      const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      try {
        await login(page, { baseURL: e2eEnv.baseURL, email: e2eEnv.adminEmail, password: e2eEnv.adminPassword });
        await openTablesAt(page, w, 900);
        const openDate = await findOpenDate(page);
        await openPopover(page);
        await pickOpenDate(page, openDate);
        await page.waitForTimeout(800);
        await revealInlineCalendar(page);
        const g = await measureInline(page);

        // (2) NO corner clipping — every cell fully inside wrapper content box
        expect(g.clipped, `no clipped cells at ${w}`).toBe(0);
        // (1) square cells + no collision
        expectNoCollisionOrClip(g.cells, { w, h: 900 });
        expect(g.collisions, `no collisions at ${w}`).toBe(0);
        // cells never touch — responsive gap keeps visible separation
        expect(g.minHGap, `inline min horizontal gap ≥3px at ${w}`).toBeGreaterThanOrEqual(3);
        expect(g.minVGap, `inline min vertical gap ≥3px at ${w}`).toBeGreaterThanOrEqual(3);
        // wrapper must be tall enough to show all rows (not collapsed)
        const rows = new Set(g.cells.map((c) => Math.round(c.t / 4)));
        expect(rows.size, `all rows visible at ${w}`).toBeGreaterThanOrEqual(5);
      } finally {
        await ctx.close();
      }
    });
  }
});
