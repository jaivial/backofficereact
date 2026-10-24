import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const ctx = b.contexts()[0];
const p1 = ctx.pages().find(x=>x.url().includes("3098"));
const p2 = await ctx.newPage();
await p2.goto("http://127.0.0.1:3098/app/pos?section=kitchen", { waitUntil: "networkidle" }); await p2.waitForTimeout(1500);
await p2.screenshot({ path: "/tmp/pos47.png" });
// Terminal 2: same sell screen
const p3 = await ctx.newPage();
await p3.goto("http://127.0.0.1:3098/app/pos", { waitUntil: "networkidle" }); await p3.waitForTimeout(2000);
const openVisitsT3 = await p3.locator('[data-testid^="pos-open-visit-"]').allTextContents();
console.log("T3 sees open visits:", openVisitsT3);
// T1 adds a dish to table 9; does T3's open-visit strip total update without reload?
await p1.goto("http://127.0.0.1:3098/app/pos", { waitUntil: "networkidle" }); await p1.waitForTimeout(2000);
await p1.getByTestId("pos-open-visit-" + (await p1.evaluate(()=>[...document.querySelectorAll('[data-testid^="pos-open-visit-"]')].map(e=>e.dataset.testid.split('-').pop())[0]))).click(); await p1.waitForTimeout(1200);
await p1.getByRole("button", { name: /^Añadir Arroz a banda$/ }).click(); await p1.waitForTimeout(2500);
const openVisitsT3b = await p3.locator('[data-testid^="pos-open-visit-"]').allTextContents();
console.log("T3 after T1 add (no reload):", openVisitsT3b);
// T3 opens the same table; check lines
await p3.getByTestId("pos-open-visit-" + (await p3.evaluate(()=>[...document.querySelectorAll('[data-testid^="pos-open-visit-"]')].map(e=>e.dataset.testid.split('-').pop())[0]))).click(); await p3.waitForTimeout(1500);
console.log("T3 lines:", (await p3.locator('.pos-line').allInnerTexts()).map(l=>l.replace(/\n/g,' ').slice(0,30)));
// T1 adds another dish; does T3 ticket update live?
await p1.getByRole("button", { name: /^Añadir Arroz de señoret$/ }).click(); await p1.waitForTimeout(3000);
console.log("T3 lines after T1 add:", (await p3.locator('.pos-line').allInnerTexts()).map(l=>l.replace(/\n/g,' ').slice(0,30)));
// T3 tries to change qty on a stale ticket
await p3.locator('.pos-line').first().locator('button[aria-label^="Sumar"]').click(); await p3.waitForTimeout(2000);
console.log("T3 err after stale edit:", await p3.getByTestId("pos-error").textContent(), "| lines:", (await p3.locator('.pos-line').allInnerTexts()).map(l=>l.replace(/\n/g,' ').slice(0,30)));
await p3.screenshot({ path: "/tmp/pos48.png" });
await p2.close(); await p3.close(); await b.close();
