import { chromium } from "@playwright/test";

// Regresion: toggling the "Descripcion" switch must fire a save request.
// getSectionsFingerprint omitted description_enabled, so the autosave
// effect early-returned and no PATCH was ever sent.
const BASE = process.env.BASE || "https://127.0.0.1:3020";
const MENU_ID = process.env.MENU_ID || "1";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const saveRequests = [];
page.on("request", (req) => {
  const url = req.url();
  if (req.method() === "PATCH" && /group-menus-v2\/\d+\/sections\/\d+\/dishes\/\d+/.test(url)) {
    saveRequests.push({ url, body: req.postData() });
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
const loginRes = await page.evaluate(async ({ url }) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }),
    credentials: "include",
  });
  return r.status;
}, { url: `${BASE}/api/admin/login` });
if (loginRes !== 200) throw new Error(`login failed: ${loginRes}`);

await page.goto(`${BASE}/app/menus/crear?menuId=${MENU_ID}&tab=platos`, { waitUntil: "load", timeout: 45_000 });

// Expand all section accordions (existing menus land on step 3 editor).
await page.waitForSelector('[data-testid^="menu-section-editor-toggle-"]', { timeout: 20_000 });
const switchSel = '[data-testid^="menu-item-editor-description-switch-"]';
let switches = await page.locator(switchSel).count();
if (switches === 0) {
  const toggles = page.locator('[data-testid^="menu-section-editor-toggle-"]');
  const n = await toggles.count();
  for (let i = 0; i < n; i++) {
    const t = toggles.nth(i);
    await t.waitFor({ state: "visible", timeout: 10_000 });
    if ((await t.getAttribute("aria-expanded")) !== "true") await t.click();
    await page.waitForTimeout(400);
  }
  await page.waitForSelector(switchSel, { timeout: 20_000 });
  switches = await page.locator(switchSel).count();
}
if (switches === 0) throw new Error("no description switches found");

const first = page.locator(switchSel).first();
const before = await first.getAttribute("aria-checked") ?? (await first.getAttribute("data-state"));
await first.click();

// Autosave debounce is 700ms; allow generous window.
await page.waitForTimeout(4_000);

if (saveRequests.length === 0) {
  throw new Error("FAIL: no PATCH section-dish request fired after description toggle");
}
const withFlag = saveRequests.some((r) => /"description_enabled":(true|false)/.test(r.body || ""));
console.log("requests:", JSON.stringify(saveRequests, null, 2));
if (!withFlag) throw new Error("FAIL: PATCH did not include description_enabled");

const after = await first.getAttribute("aria-checked") ?? (await first.getAttribute("data-state"));
console.log(`OK: ${saveRequests.length} PATCH fired, description_enabled present. switch ${before} -> ${after}`);

// Restore original state so the test DB is left as found.
await first.click();
await page.waitForTimeout(4_000);
console.log("restored:", saveRequests.length, "total PATCHes");
await browser.close();
