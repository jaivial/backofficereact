import { chromium } from "@playwright/test";
const BASE = "https://backoffice.alqueriavillacarmen.com";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => { if (["error","warning"].includes(m.type())) errs.push(m.text().slice(0,200)); });
page.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0,200)));
await page.goto(BASE, { waitUntil: "load", timeout: 45_000 });
await page.evaluate(async ({ url, email, password }) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, password }), credentials: "include" });
  return r.status;
}, { url: `${BASE}/api/admin/login`, email: process.env.BO_E2E_EMAIL || "", password: process.env.BO_E2E_PASSWORD || "" });
await page.goto(`${BASE}/app/config?content=contacto`, { waitUntil: "networkidle", timeout: 45_000 });
const section = page.locator('[data-ui="whatsapp-connection"]');
await section.waitFor({ state: "visible", timeout: 15_000 });
await page.waitForTimeout(8000);
const state = await section.getAttribute("data-state");
const qr = section.locator("img.bo-qr");
const qrCount = await qr.count();
let natW = null, srcLen = null, visible = false;
if (qrCount) {
  natW = await qr.first().evaluate((el) => el.naturalWidth);
  srcLen = await qr.first().evaluate((el) => (el.src || "").length);
  visible = await qr.first().isVisible();
}
console.log(JSON.stringify({ state, qrCount, natW, srcLen, visible, errs: errs.slice(0,5) }));
await section.screenshot({ path: "/tmp/wa-panel-prod.png" });
await browser.close();
