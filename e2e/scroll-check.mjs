// Scroll check for /app/reservas tabs (desktop + mobile).
// Uses date 2026-08-01 (has 4 bookings). Checks each tab:
//  - is there overflow?
//  - wheel (desktop) / CDP touch swipe (mobile) scrolls down
//  - same method scrolls back up
import { chromium, devices } from "@playwright/test";

const BASE = "https://localhost:3011";
const EMAIL = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || "admin123";
const DATE = "2026-08-01";
const TABS = ["activas", "canceladas", "modificadas"];

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
  const res = await page.evaluate(async ({ url, email, password }) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
      credentials: "include",
    });
    return { status: r.status, data: await r.json() };
  }, { url: `${BASE}/api/admin/login`, email: EMAIL, password: PASSWORD });
  if (!res.data?.success) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.data)}`);
}

async function openTab(page, tab) {
  const tabBtn = page.locator(`[data-testid="bookings-view-tabs"] button, [data-testid="bookings-view-tabs"] [role="tab"], [data-testid="bookings-view-tabs"] a`).filter({ hasText: new RegExp(tab, "i") }).first();
  const isActive = await tabBtn.getAttribute("aria-selected");
  if (isActive === "true") return;
  await tabBtn.click();
  await page.waitForTimeout(800);
}

async function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    const se = document.scrollingElement;
    const cs = main ? getComputedStyle(main) : null;
    return {
      innerHeight: window.innerHeight,
      docScrollH: se.scrollHeight,
      docClientH: se.clientHeight,
      mainScrollH: main ? main.scrollHeight : 0,
      mainClientH: main ? main.clientHeight : 0,
      mainScrollTop: main ? main.scrollTop : 0,
      mainOverflowY: cs ? cs.overflowY : null,
      mainTouchAction: cs ? cs.touchAction : null,
      bodyOverflow: getComputedStyle(document.body).overflow,
    };
  });
}

async function scrollDownWheel(page) {
  const main = page.locator(".bo-main");
  await main.hover();
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
}

async function scrollUpWheel(page) {
  const main = page.locator(".bo-main");
  await main.hover();
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel(0, -350);
    await page.waitForTimeout(40);
  }
  await page.waitForTimeout(300);
}

async function gestureInfo(page) {
  return page.evaluate(() => {
    const main = document.querySelector(".bo-main");
    const r = main ? main.getBoundingClientRect() : { x: 0, y: 0, width: 390, height: 700 };
    const midY = r.y + Math.min(300, r.height / 2);
    const el = document.elementFromPoint(r.x + r.width / 2, midY);
    const cs = el ? getComputedStyle(el) : null;
    // nearest scrollable ancestor chain
    let node = el;
    const chain = [];
    while (node && chain.length < 6) {
      const c = getComputedStyle(node);
      const sc = c.overflowY === "auto" || c.overflowY === "scroll";
      chain.push(`${node.tagName.toLowerCase()}.${String(node.className).split(" ").slice(0, 2).join(".") || ""} overflowY=${c.overflowY} touchAction=${c.touchAction}${sc ? " SCROLLABLE" : ""}`);
      node = node.parentElement;
    }
    return { rect: r, midY, el: el ? `${el.tagName}.${String(el.className).split(" ").slice(0, 2).join(".")}` : null, touchAction: cs ? cs.touchAction : null, overflowY: cs ? cs.overflowY : null, chain };
  });
}

async function touchSwipe(page, yDistance, startFrac = 0.5) {
  const cdp = await page.context().newCDPSession(page);
  const info = await page.evaluate((frac) => {
    const main = document.querySelector(".bo-main");
    const r = main.getBoundingClientRect();
    const y = r.y + Math.max(120, r.height * frac);
    return { x: r.x + r.width / 2, y, width: r.width, height: r.height };
  }, startFrac);
  await cdp.send("Input.synthesizeScrollGesture", {
    x: info.x,
    y: info.y,
    xDistance: 0,
    yDistance,
    speed: 900,
    gestureSourceType: "touch",
  });
  await page.waitForTimeout(900);
}

async function scrollDownTouch(page) {
  await touchSwipe(page, -550, 0.4);
  if ((await measure(page)).mainScrollTop < 20) await touchSwipe(page, -550, 0.7);
}

async function scrollUpTouch(page) {
  await touchSwipe(page, 550, 0.4);
  if ((await measure(page)).mainScrollTop > 40) await touchSwipe(page, 700, 0.5);
}

const results = [];

async function runScenario(label, page, kind) {
  await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2600);

  const dayOpen = await page.evaluate(() => !!document.querySelector('[data-testid="bookings-view-tabs"]'));
  if (!dayOpen) {
    results.push({ label, tab: "all", note: "day-closed (tabs not rendered)", ok: false });
    return;
  }

  for (const tab of TABS) {
    await openTab(page, tab);
    await page.waitForTimeout(700);

    const before = await measure(page);
    const overflow = before.mainScrollH > before.mainClientH + 1;
    if (!overflow) {
      results.push({ label, tab, note: "no-overflow (content fits viewport)", scrollable: false, ok: true });
      continue;
    }

    const info = await gestureInfo(page);

    if (kind === "touch") await scrollDownTouch(page);
    else await scrollDownWheel(page);
    const afterDown = await measure(page);
    const downOk = afterDown.mainScrollTop > 20;

    if (kind === "touch") await scrollUpTouch(page);
    else await scrollUpWheel(page);
    const afterUp = await measure(page);
    const upOk = afterUp.mainScrollTop < 20;

    results.push({
      label,
      tab,
      scrollable: true,
      down_ok: downOk,
      up_ok: upOk,
      mainScrollTop_down: afterDown.mainScrollTop,
      mainScrollTop_up: afterUp.mainScrollTop,
      overflowY: before.mainOverflowY,
      touchAction: before.mainTouchAction,
      gestureTarget: info.el,
      targetTouchAction: info.touchAction,
    });
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const date = DATE;
  console.log(`Date: ${date}`);

  for (const [label, vp] of [["desktop-1440x900", { width: 1440, height: 900 }], ["desktop-1024x768", { width: 1024, height: 768 }]]) {
    const ctx = await browser.newContext({ viewport: vp, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await login(page);
    await runScenario(label, page, "wheel");
    await ctx.close();
  }

  const ctxM = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
  const pageM = await ctxM.newPage();
  await login(pageM);
  await runScenario("mobile-iphone12", pageM, "touch");
  await ctxM.close();
} finally {
  await browser.close();
}

console.log("\n===== SCROLL CHECK RESULTS =====");
console.table(results);
const failed = results.filter((r) => r.ok === false || r.down_ok === false || r.up_ok === false);
if (failed.length) {
  console.log(`\n${failed.length} FAILURES:`);
  for (const f of failed) console.log(JSON.stringify(f, null, 2));
} else {
  console.log("\nAll tabs scroll down and up OK on desktop + mobile.");
}
