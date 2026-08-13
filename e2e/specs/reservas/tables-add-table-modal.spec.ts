import { test, expect, type Page } from "@playwright/test";
import { e2eEnv } from "../../config";
import { login } from "../../helpers/auth";

/**
 * Visual + scrolling contract for the "Anadir mesa" (table editor) modal on
 * /app/reservas/tables.
 *
 * Covers the issues seen across breakpoints:
 *  - the modal never overflows the viewport;
 *  - on mobile the table-preview area is not an excessive fixed height (it must
 *    shrink so the form is reachable without needless scrolling);
 *  - the inner scroll area scrolls vertically (overflow-y auto/scroll) and is
 *    not laid out as a horizontal flex row;
 *  - the footer (Guardar) stays reachable.
 *
 * Narrow widths run with iPhone emulation (isMobile + hasTouch).
 */

const ROUTE = "/app/reservas/tables";
const MARGIN = 4;
const MOBILE_PREVIEW_MAX = 260; // px; the old fixed min-height was 340

async function openAddTableModal(page: Page) {
  await page.goto(`${e2eEnv.baseURL}${ROUTE}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.locator('[data-testid="table-map-date-picker"]').first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);
  // The editor lives in the open-day view; pick the first open day.
  const openDate = await page.evaluate(async () => {
    const iso = (off: number) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };
    for (let off = -5; off <= 60; off++) {
      const date = iso(off);
      try {
        const r = await fetch(`/api/admin/config/day?date=${date}`, { credentials: "include" });
        const j = await r.json();
        if (j.isOpen) return date;
      } catch { /* keep scanning */ }
    }
    return null as string | null;
  });
  if (!openDate) throw new Error("No open day found; cannot open add-table modal");
  await page.locator('[data-testid="table-map-date-picker"]').first().click();
  await page.waitForSelector('[data-ui="date-picker-popover"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  const cellAt = () => page.locator(`[data-ui="date-picker-popover"] button[data-date="${openDate}"]`);
  if (!(await cellAt().count())) {
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-ui="date-picker-popover"] [data-testid="month-calendar-prev"]').click();
      await page.waitForTimeout(150);
      if (await cellAt().count()) break;
    }
    for (let i = 0; i < 6 && !(await cellAt().count()); i++) {
      await page.locator('[data-ui="date-picker-popover"] [data-testid="month-calendar-next"]').click();
      await page.waitForTimeout(150);
    }
  }
  await cellAt().click();
  await page.waitForTimeout(800);
  // open the add-table modal (top button preferred, else the 3-dots menu)
  const topBtn = page.locator('[data-ui="add-table-top-btn"]').first();
  if (await topBtn.count()) {
    await topBtn.click();
  } else {
    await page.locator('[data-ui="menu-trigger"]').first().click();
    await page.waitForTimeout(250);
    await page.locator('[data-ui="add-table-btn"]').first().click();
  }
  await page.waitForSelector(".bo-tableEditorModal", { timeout: 10_000 });
  await page.waitForTimeout(600); // layout settle
}

type Geom = {
  modal: { l: number; t: number; r: number; b: number; w: number; h: number };
  vw: number; vh: number;
  previewH: number;
  viewportOverflowY: string;
  viewportFlexDirection: string;
  viewportDisplay: string;
  saveBtn: { top: number; bottom: number } | null;
};

async function measure(page: Page): Promise<Geom> {
  return page.evaluate(() => {
    const modal = document.querySelector(".bo-tableEditorModal")!;
    const mr = modal.getBoundingClientRect();
    const preview = document.querySelector(".bo-tableEditorPreviewWrap");
    const vp = document.querySelector(".bo-tableEditorGridScroll .bo-scrollAreaViewport") as HTMLElement | null;
    const save = document.querySelector('[data-ui="save-editor-btn"]') as HTMLElement | null;
    const vps = vp ? getComputedStyle(vp) : null;
    return {
      modal: { l: mr.left, t: mr.top, r: mr.right, b: mr.bottom, w: mr.width, h: mr.height },
      vw: window.innerWidth,
      vh: window.innerHeight,
      previewH: preview ? Math.round(preview.getBoundingClientRect().height) : 0,
      viewportOverflowY: vps ? vps.overflowY : "",
      viewportFlexDirection: vps ? vps.flexDirection : "",
      viewportDisplay: vps ? vps.display : "",
      saveBtn: save ? { top: save.getBoundingClientRect().top, bottom: save.getBoundingClientRect().bottom } : null,
    };
  });
}

for (const w of [1280, 390, 360, 320]) {
  const mobile = w <= 768;
  const height = mobile ? 844 : 800;
  test(`add-table modal fits viewport + scroll/preview sane @ ${w}px${mobile ? " (iPhone)" : ""}`, async ({ browser }) => {
    const ctxOpts: Record<string, unknown> = { ignoreHTTPSErrors: true, viewport: { width: w, height } };
    if (mobile) {
      ctxOpts.isMobile = true;
      ctxOpts.hasTouch = true;
      ctxOpts.deviceScaleFactor = 3;
      ctxOpts.userAgent =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    }
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    try {
      await login(page, { baseURL: e2eEnv.baseURL, email: e2eEnv.adminEmail, password: e2eEnv.adminPassword });
      await openAddTableModal(page);
      const g = await measure(page);

      // (1) modal fully within viewport
      expect(g.modal.l, `modal left ≥0 at ${w}`).toBeGreaterThanOrEqual(-MARGIN);
      expect(g.modal.r, `modal right ≤vw at ${w}`).toBeLessThanOrEqual(g.vw + MARGIN);
      expect(g.modal.t, `modal top ≥0 at ${w}`).toBeGreaterThanOrEqual(-MARGIN);
      expect(g.modal.b, `modal bottom ≤vh at ${w}`).toBeLessThanOrEqual(g.vh + MARGIN);

      // (2) mobile preview area is not the excessive fixed 340px
      if (mobile) {
        expect(g.previewH, `mobile preview height ≤${MOBILE_PREVIEW_MAX}px at ${w}`).toBeLessThanOrEqual(MOBILE_PREVIEW_MAX);
      }

      // (3) inner scroll area scrolls vertically and is not a horizontal flex row.
      // (block elements report flex-direction:"row" as the initial value, so we
      //  assert on display: the buggy override set display:flex.)
      expect(["auto", "scroll"]).toContain(g.viewportOverflowY);
      expect(g.viewportDisplay, `scroll viewport not display:flex at ${w}`).not.toBe("flex");

      // (4) footer (Guardar) stays within the viewport (reachable)
      expect(g.saveBtn, `save button present at ${w}`).not.toBeNull();
      expect(g.saveBtn!.bottom, `save button within viewport at ${w}`).toBeLessThanOrEqual(g.vh + MARGIN);
      expect(g.saveBtn!.top, `save button not above viewport at ${w}`).toBeGreaterThanOrEqual(-MARGIN);
    } finally {
      await ctx.close();
    }
  });
}
