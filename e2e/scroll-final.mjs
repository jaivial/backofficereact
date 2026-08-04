// Definitive scroll check: all tabs, desktop + mobile + tablet.
// Down: wheel (desktop) / touch fling (mobile). Up: repeated until top (max 6).
import { chromium, devices } from "@playwright/test";

const BASE = "https://localhost:3011";
const DATE = "2026-08-01";

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
  const r = await page.evaluate(async (url) => {
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }), credentials: "include" });
    return { status: resp.status, data: await resp.json() };
  }, `${BASE}/api/admin/login`);
  if (!r.data?.success) throw new Error(`login failed ${r.status}`);
}

async function openTab(page, tab) {
  const tabBtn = page.locator(`[data-testid="bookings-view-tabs"] button, [data-testid="bookings-view-tabs"] [role="tab"], [data-testid="bookings-view-tabs"] a`).filter({ hasText: new RegExp(tab, "i") }).first();
  const isActive = await tabBtn.getAttribute("aria-selected");
  if (isActive === "true") return;
  await tabBtn.click();
  await page.waitForTimeout(1000);
}

async function st(page) { return page.evaluate(() => document.querySelector(".bo-main")?.scrollTop ?? -1); }

async function wheelScroll(page, dy, times = 12) {
  await page.locator(".bo-main").hover();
  for (let i = 0; i < times; i++) { await page.mouse.wheel(0, dy); await new Promise((r) => setTimeout(r, 25)); }
  await page.waitForTimeout(350);
}

async function touchFling(page, dir) {
  const cdp = await page.context().newCDPSession(page);
  const startY = await page.evaluate(() => {
    const r = document.querySelector(".bo-main").getBoundingClientRect();
    return r.y + r.height * 0.6;
  });
  const steps = 10;
  const delta = (dir === "down" ? -1 : 1) * 26;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: startY, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const y = startY + delta * i;
    if (y < 40) break;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
    await new Promise((r) => setTimeout(r, 25));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(800);
}

const results = [];

async function scenario(label, ctxOptions, kind) {
  const ctx = await browser.newContext({ ...ctxOptions, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2600);

  const tabsVisible = await page.evaluate(() => !!document.querySelector('[data-testid="bookings-view-tabs"]'));
  if (!tabsVisible) { results.push({ label, tab: "all", note: "day-closed" }); await ctx.close(); return; }

  for (const tab of ["activas", "canceladas", "modificadas"]) {
    await openTab(page, tab);
    await page.evaluate(() => { document.querySelector(".bo-main").scrollTop = 0; });
    await page.waitForTimeout(350);

    const dims = await page.evaluate(() => {
      const m = document.querySelector(".bo-main");
      return { sh: m.scrollHeight, ch: m.clientHeight };
    });
    if (dims.sh <= dims.ch + 1) { results.push({ label, tab, overflow: false, ok: true, note: "fits viewport" }); continue; }

    // DOWN
    if (kind === "touch") { await touchFling(page, "down"); } else { await wheelScroll(page, 350, 15); }
    const down = await st(page);
    const downOk = down > 20;

    // UP (repeated until top)
    let up = down;
    let flings = 0;
    while (up > 20 && flings < 6) {
      if (kind === "touch") { await touchFling(page, "up"); } else { await wheelScroll(page, -350, 15); }
      up = await st(page);
      flings++;
    }
    const upOk = up < 20;

    results.push({
      label, tab,
      overflow: true,
      down_ok: downOk, up_ok: upOk,
      scrollDown: down, scrollUpFinal: up, gestures: flings,
      sh: dims.sh, ch: dims.ch,
    });
  }
  await ctx.close();
}

const browser = await chromium.launch({ headless: true });
try {
  await scenario("desktop-1920x1080", { viewport: { width: 1920, height: 1080 } }, "wheel");
  await scenario("desktop-1440x900", { viewport: { width: 1440, height: 900 } }, "wheel");
  await scenario("desktop-1024x768", { viewport: { width: 1024, height: 768 } }, "wheel");
  await scenario("mobile-iphone12", { ...devices["iPhone 12"] }, "touch");
  await scenario("mobile-small-320x568", { userAgent: devices["iPhone 12"].userAgent, viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, "touch");
  await scenario("tablet-ipad11", { ...devices["iPad Pro 11"] }, "touch");
} finally {
  await browser.close();
}

console.log("\n===== FINAL SCROLL CHECK =====");
console.table(results);
const bad = results.filter((r) => r.ok === false || r.down_ok === false || r.up_ok === false);
if (bad.length) {
  console.log(`\n${bad.length} FAILURES:`);
  for (const b of bad) console.log(JSON.stringify(b));
} else {
  console.log("\nAll tabs: scroll down & up OK on all desktop/mobile/tablet viewports.");
}
