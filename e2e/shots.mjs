// Screenshots of each tab on desktop + mobile for visual confirmation.
import { chromium, devices } from "@playwright/test";
const BASE = "https://localhost:3011";
const DATE = "2026-08-01";
const OUT = "e2e/screenshots/scroll-check";

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
import fs from "node:fs";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

// Desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2800);
  for (const tab of ["activas", "canceladas", "modificadas"]) {
    await openTab(page, tab);
    await page.screenshot({ path: `${OUT}/desktop-${tab}.png`, fullPage: false });
  }
  await ctx.close();
}

// Mobile
{
  const ctx = await browser.newContext({ ...devices["iPhone 12"], ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await login(page);
  await page.goto(`${BASE}/app/reservas?date=${DATE}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(2800);
  for (const tab of ["activas", "canceladas", "modificadas"]) {
    await openTab(page, tab);
    await page.screenshot({ path: `${OUT}/mobile-${tab}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log("screenshots saved to " + OUT);
