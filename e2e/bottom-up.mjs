// Verify scroll UP from the very bottom (max scroll) on mobile, per tab.
import { chromium, devices } from "@playwright/test";
const BASE = "https://localhost:3011";
const DATE = "2026-08-01";
const W = 390;
async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
  await page.evaluate(async (url) => {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }), credentials: "include" });
  }, `${BASE}/api/admin/login`);
}
async function openTab(page, tab) {
  const tabBtn = page.locator(`[data-testid="bookings-view-tabs"] button, [data-testid="bookings-view-tabs"] [role="tab"], [data-testid="bookings-view-tabs"] a`).filter({ hasText: new RegExp(tab, "i") }).first();
  const isActive = await tabBtn.getAttribute("aria-selected");
  if (isActive === "true") return;
  await tabBtn.click();
  await page.waitForTimeout(1100);
}
async function st(page) { return page.evaluate(() => document.querySelector(".bo-main")?.scrollTop ?? -1); }
async function maxSt(page) { return page.evaluate(() => { const m = document.querySelector(".bo-main"); return m.scrollHeight - m.clientHeight; }); }
async function touchFling(page, dir) {
  const cdp = await page.context().newCDPSession(page);
  const startY = await page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    const r = main.getBoundingClientRect();
    return r.y + r.height * 0.6;
  });
  const steps = 12;
  const delta = (dir === "down" ? -1 : 1) * 28;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: W / 2, y: startY, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const y = startY + delta * i;
    if (y < 40) break;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: W / 2, y, radiusX: 2, radiusY: 2, force: 1, id: 1 }] });
    await new Promise((r) => setTimeout(r, 25));
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1100);
}
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await login(page);
await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
await page.waitForTimeout(2600);
for (const tab of ["activas", "canceladas", "modificadas"]) {
  await openTab(page, tab);
  await page.evaluate(() => { document.querySelector(".bo-main").scrollTop = 0; });
  await page.waitForTimeout(400);
  await page.locator(".bo-main").hover();
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const atBottom = await st(page);
  const mx = await maxSt(page);
  await touchFling(page, "up");
  const afterUp = await st(page);
  console.log(`TAB ${tab}: bottom=${atBottom} max=${mx} -> after touch up: ${afterUp} ${afterUp < 40 ? "OK" : "STUCK"}`);
}
await browser.close();
