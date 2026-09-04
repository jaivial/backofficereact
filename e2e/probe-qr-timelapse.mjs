import { chromium } from "@playwright/test";
const BASE = "https://backoffice.alqueriavillacarmen.com";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "load", timeout: 45_000 });
await page.evaluate(async ({ url, email, password }) => {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, password }), credentials: "include" });
}, { url: `${BASE}/api/admin/login`, email: process.env.BO_E2E_EMAIL || "", password: process.env.BO_E2E_PASSWORD || "" });
await page.goto(`${BASE}/app/config?content=contacto`, { waitUntil: "networkidle", timeout: 45_000 });
const section = page.locator('[data-ui="whatsapp-connection"]');
await section.waitFor({ state: "visible", timeout: 15_000 });

// start fresh connect so the timeline begins at qr_ready
const st0 = await section.getAttribute("data-state");
if (st0 === "disconnected") {
  await section.locator('button[aria-label="Conectar WhatsApp"]').click();
}
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(5000);
  const state = await section.getAttribute("data-state").catch(() => "?");
  const qrCount = await section.locator("img.bo-qr").count();
  const natW = qrCount ? await section.locator("img.bo-qr").first().evaluate((el) => el.naturalWidth) : null;
  const text = (await section.textContent())?.replace(/\s+/g, " ").trim().slice(0, 110);
  console.log(`t+${(i + 1) * 5}s state=${state} qrImg=${qrCount} natW=${natW} | ${text}`);
  if (i === 1 || i === 6) await section.screenshot({ path: `/tmp/wa-timeline-${i}.png` });
}
await browser.close();
