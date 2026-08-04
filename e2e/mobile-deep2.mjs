// Deep mobile repro v2: reset scroll per tab, test down + up, log events.
import { chromium, devices } from "@playwright/test";

const BASE = "https://localhost:3011";
const DATE = "2026-08-01";

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
  await page.waitForTimeout(1000);
}

async function resetScroll(page) {
  await page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    if (main) main.scrollTop = 0;
  });
  await page.waitForTimeout(400);
}

async function installProbe(page) {
  await page.evaluate(() => {
    (window).__scrollLog = [];
    const main = document.querySelector(".bo-main");
    const log = (ev) => {
      const t = ev.target;
      const cls = t && t.className ? String(t.className).split(" ").slice(0, 3).join(".") : t?.tagName;
      (window).__scrollLog.push({
        type: ev.type,
        tag: cls,
        prevented: ev.defaultPrevented,
        st: main ? main.scrollTop : -1,
      });
    };
    for (const ev of ["touchstart", "touchmove", "touchend", "wheel"]) {
      document.addEventListener(ev, log, { passive: true, capture: true });
    }
    if (main) main.addEventListener("scroll", () => log({ type: "scroll", target: main, defaultPrevented: false }), { passive: true });
  });
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await login(page);
await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
await page.waitForTimeout(2600);

const cdp = await page.context().newCDPSession(page);

for (const tab of ["activas", "canceladas", "modificadas"]) {
  await openTab(page, tab);
  await resetScroll(page);
  await installProbe(page);

  const dims = await page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    return { sh: main.scrollHeight, ch: main.clientHeight, st: main.scrollTop };
  });
  console.log(`\n=== TAB ${tab} === scrollH=${dims.sh} clientH=${dims.ch} scrollTop=${dims.st}`);

  const move = async (yDistance, speed = 700, fracs = [0.25, 0.5, 0.75]) => {
    for (const frac of fracs) {
      const y = await page.evaluate((f) => {
        const main = document.querySelector(".bo-main");
        const r = main.getBoundingClientRect();
        return r.y + r.height * f;
      }, frac);
      const before = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
      await cdp.send("Input.synthesizeScrollGesture", { x: 195, y, xDistance: 0, yDistance, speed, gestureSourceType: "touch" });
      await page.waitForTimeout(1100);
      const after = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
      const log = await page.evaluate(() => (window).__scrollLog);
      const interesting = log.filter((l) => ["touchmove", "wheel", "scroll"].includes(l.type));
      console.log(`  dir=${yDistance < 0 ? "DOWN" : "UP"} frac=${frac} scrollTop ${before} -> ${after} | ${interesting.slice(0, 5).map((l) => `${l.type}@${l.st}${l.prevented ? "!prev" : ""}`).join(" ") || "no-moves"}`);
      if (yDistance < 0 && after - before > 5) break; // moved enough, stop
      if (yDistance > 0 && before - after > 5) break;
    }
  };

  await move(-600); // down
  await move(600);  // up
  const final = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
  console.log(`  FINAL scrollTop=${final} ${final < 20 ? "(back at top OK)" : "(STUCK NOT AT TOP)"}`);
}

await browser.close();
