import { chromium } from "@playwright/test";
const BASE = "https://localhost:3011";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
await page.evaluate(async ({ url }) => {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }), credentials: "include" });
}, { url: `${BASE}/api/admin/login` });

function iso(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

async function j(page, url) {
  try {
    const r = await page.evaluate(async ({ url }) => {
      const resp = await fetch(url, { credentials: "include" });
      const text = await resp.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 120), status: resp.status }; }
      return data;
    }, { url });
    return r;
  } catch (e) {
    return { error: String(e) };
  }
}

for (let back = 0; back <= 14; back++) {
  const date = iso(back);
  const out = await j(page, `${BASE}/api/admin/bookings?date=${date}&page=1&count=15`);
  const day = await j(page, `${BASE}/api/admin/config/day?date=${date}`);
  const canc = await j(page, `${BASE}/api/admin/bookings/cancelled?date=${date}`);
  const mods = await j(page, `${BASE}/api/admin/bookings/modified?date=${date}`);
  const nBook = out.bookings ? out.bookings.length : (out.total_count ?? out.raw ?? "?");
  const nCanc = canc.staff || canc.customer || canc.whatsapp ? (canc.staff?.length ?? 0) + (canc.customer?.length ?? 0) + (canc.whatsapp?.length ?? 0) : (canc.raw ?? "?");
  const nMods = mods.staff || mods.customer || mods.whatsapp ? (mods.staff?.length ?? 0) + (mods.customer?.length ?? 0) + (mods.whatsapp?.length ?? 0) : (mods.raw ?? "?");
  console.log(`${date} open=${day?.isOpen} bookings=${nBook} cancelled=${nCanc} modified=${nMods}`);
}
await browser.close();
