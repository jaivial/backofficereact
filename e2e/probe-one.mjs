import { chromium } from "@playwright/test";
const BASE = "https://localhost:3011";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "load", timeout: 45_000 });
await page.evaluate(async ({ url }) => {
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: "admin@villacarmen.com", password: "admin123" }), credentials: "include" });
}, { url: `${BASE}/api/admin/login` });
const out = await page.evaluate(async ({ url }) => {
  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();
  return { status: r.status, text: text.slice(0, 800) };
}, { url: `${BASE}/api/admin/bookings/cancelled?date=2026-08-01` });
console.log("cancelled:", JSON.stringify(out, null, 2));
const out2 = await page.evaluate(async ({ url }) => {
  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();
  return { status: r.status, text: text.slice(0, 800) };
}, { url: `${BASE}/api/admin/bookings/modified?date=2026-08-01` });
console.log("modified:", JSON.stringify(out2, null, 2));
const out3 = await page.evaluate(async ({ url }) => {
  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();
  return { status: r.status, text: text.slice(0, 800) };
}, { url: `${BASE}/api/admin/bookings?date=2026-08-01&page=1&count=15` });
console.log("list:", JSON.stringify(out3, null, 2));
await browser.close();
