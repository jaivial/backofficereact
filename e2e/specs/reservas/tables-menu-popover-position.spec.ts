import { test, expect, type Page } from "@playwright/test";
import { e2eEnv } from "../../config";
import { login } from "../../helpers/auth";

/**
 * Position contract for the table-map "3 dots" (ellipsis) menu popover.
 *
 * The popover (`[data-ui="map-menu-tooltip"]`) is opened from the top
 * controls (`[data-ui="menu-trigger"]`). It must be fully visible at every
 * breakpoint — never clipped by the viewport on any side — so its fixed
 * position is clamped to the viewport (with a small margin), horizontally and
 * vertically.
 *
 * Narrow widths run with iPhone emulation (isMobile + hasTouch) because that is
 * the real target and the desktop layout hides the trigger below ~340px.
 */

const ROUTE = "/app/reservas/tables";
const MENU_BTN = '[data-ui="menu-trigger"]';
const MENU_POP = '[data-ui="map-menu-tooltip"]';
const MARGIN = 8;

const WIDTHS = [1280, 1024, 768, 430, 390, 360, 320];

async function openDay(page: Page, width: number, height: number, mobile: boolean) {
  const ctxOpts: Record<string, unknown> = { ignoreHTTPSErrors: true, viewport: { width, height } };
  if (mobile) {
    ctxOpts.isMobile = true;
    ctxOpts.hasTouch = true;
    ctxOpts.deviceScaleFactor = 3;
    ctxOpts.userAgent =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  }
  // page already lives in a context created by the test; viewport is set there.
  await page.goto(`${e2eEnv.baseURL}${ROUTE}`, { waitUntil: "networkidle", timeout: 45_000 });
  await page.locator('[data-testid="table-map-date-picker"]').first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(400);
}

/** The menu only exists in the open-day view; pick the first open day. */
async function pickOpenDate(page: Page) {
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
  if (!openDate) throw new Error("No open day found; cannot open the map menu");
  await page.locator('[data-testid="table-map-date-picker"]').first().click();
  await page.waitForSelector('[data-ui="date-picker-popover"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  const cellAt = () => page.locator(`[data-ui="date-picker-popover"] button[data-date="${openDate}"]`);
  if (await cellAt().count()) { await cellAt().click(); await page.waitForTimeout(800); return; }
  for (let i = 0; i < 3; i++) {
    await page.locator('[data-ui="date-picker-popover"] [data-testid="month-calendar-prev"]').click();
    await page.waitForTimeout(150);
    if (await cellAt().count()) { await cellAt().click(); await page.waitForTimeout(800); return; }
  }
  for (let i = 0; i < 6; i++) {
    await page.locator('[data-ui="date-picker-popover"] [data-testid="month-calendar-next"]').click();
    await page.waitForTimeout(150);
    if (await cellAt().count()) { await cellAt().click(); await page.waitForTimeout(800); return; }
  }
  throw new Error(`Could not navigate popover to open date ${openDate}`);
}

async function openMenu(page: Page) {
  await page.locator(MENU_BTN).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator(MENU_BTN).first().click();
  await page.waitForSelector(MENU_POP, { timeout: 8_000 });
  await page.waitForTimeout(450); // rAF + layout settle
}

type PopRect = { l: number; t: number; r: number; b: number; w: number; h: number; vw: number; vh: number };
async function measureMenu(page: Page): Promise<PopRect> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel)!;
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, vw: window.innerWidth, vh: window.innerHeight };
  }, MENU_POP);
}

for (const w of WIDTHS) {
  const mobile = w <= 768;
  const height = mobile ? 844 : 900;
  test(`ellipsis menu popover fully on-screen @ ${w}px${mobile ? " (iPhone)" : ""}`, async ({ browser }) => {
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
      await openDay(page, w, height, mobile);
      await pickOpenDate(page);
      await openMenu(page);
      const g = await measureMenu(page);

      // Fully visible: every edge within the viewport (small margin allowed).
      expect(g.l, `menu left ≥ ${MARGIN}px at ${w}`).toBeGreaterThanOrEqual(MARGIN);
      expect(g.r, `menu right ≤ vw-${MARGIN} at ${w}`).toBeLessThanOrEqual(g.vw - MARGIN);
      expect(g.t, `menu top ≥ ${MARGIN}px at ${w}`).toBeGreaterThanOrEqual(MARGIN);
      expect(g.b, `menu bottom ≤ vh-${MARGIN} at ${w}`).toBeLessThanOrEqual(g.vh - MARGIN);
      // Sanity: popover actually rendered with content.
      expect(g.w, `menu has width at ${w}`).toBeGreaterThan(100);
    } finally {
      await ctx.close();
    }
  });
}
