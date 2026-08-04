// Deep mobile repro for scroll issues on /app/reservas tabs.
// Instruments touch/scroll/wheel events and tries multiple gesture styles.
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
  await page.waitForTimeout(900);
}

async function installProbe(page) {
  await page.evaluate(() => {
    (window).__scrollLog = [];
    const log = (ev, extra = "") => {
      const main = document.querySelector(".bo-main");
      const t = ev.target;
      const cls = t && t.className ? String(t.className).split(" ").slice(0, 3).join(".") : t?.tagName;
      (window).__scrollLog.push({
        t: ev.type,
        tag: cls,
        ts: ev.timestamp ? ev.timestamp.toFixed(0) : null,
        defaultPrevented: ev.defaultPrevented,
        scrollTop: main ? main.scrollTop : -1,
        extra,
      });
    };
    for (const ev of ["touchstart", "touchmove", "touchend", "wheel", "pointerdown", "pointermove", "pointerup"]) {
      document.addEventListener(ev, log, { passive: true, capture: true });
    }
    const main = document.querySelector(".bo-main");
    if (main) main.addEventListener("scroll", log.bind(null, { type: "scroll", target: main, timestamp: performance.now(), defaultPrevented: false }), { passive: true });
  });
}

async function getLog(page) {
  return page.evaluate(() => (window).__scrollLog || []);
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await login(page);
await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
await page.waitForTimeout(2600);

for (const tab of ["activas", "canceladas", "modificadas"]) {
  await openTab(page, tab);
  await installProbe(page);
  const info = await page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    const r = main.getBoundingClientRect();
    const out = [];
    for (const frac of [0.25, 0.5, 0.75]) {
      const y = r.y + r.height * frac;
      const el = document.elementFromPoint(r.x + r.width / 2, y);
      const cs = el ? getComputedStyle(el) : null;
      out.push({ frac, y, tag: el ? `${el.tagName}.${String(el.className).split(" ").slice(0, 2).join(".")}` : null, touchAction: cs?.touchAction, overflow: cs?.overflowY, hasPointer: !!el?.onpointerdown || el?.getAttribute?.("data-") !== null });
    }
    return { mainScrollH: main.scrollHeight, mainClientH: main.clientHeight, scrollTop: main.scrollTop, points: out };
  });
  console.log(`\n=== TAB ${tab} ===`);
  console.log(JSON.stringify(info, null, 2));

  // Try touch swipe at each frac
  const cdp = await page.context().newCDPSession(page);
  for (const frac of [0.25, 0.5, 0.75]) {
    const y = info.points.find((p) => p.frac === frac).y;
    const before = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
    await cdp.send("Input.synthesizeScrollGesture", { x: 195, y, xDistance: 0, yDistance: -500, speed: 700, gestureSourceType: "touch" });
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
    const log = await getLog(page);
    const touches = log.filter((l) => l.t === "touchstart" || l.t === "touchmove" || l.t === "scroll");
    console.log(`swipe@${frac} y=${y.toFixed(0)} scrollTop ${before} -> ${after}; events: ${touches.slice(0, 8).map((l) => `${l.t}:${l.tag}${l.defaultPrevented ? "!prevented" : ""}${l.t === "scroll" ? `=${l.scrollTop}` : ""}`).join(" | ")}`);
  }

  // Try keyboard PageDown (scrollability proof)
  const beforeKb = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
  await page.keyboard.press("PageDown");
  await page.waitForTimeout(500);
  const afterKb = await page.evaluate(() => document.querySelector(".bo-main").scrollTop);
  console.log(`keyboard PageDown: ${beforeKb} -> ${afterKb}`);
}

await browser.close();
