import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
await p.goto("http://127.0.0.1:3098/app/pos", { waitUntil: "networkidle" }); await p.waitForTimeout(2000);
await p.getByTestId("pos-open-visit-" + (await p.evaluate(()=>[...document.querySelectorAll('[data-testid^="pos-open-visit-"]')].map(e=>e.dataset.testid.split('-').pop())[0]))).click(); await p.waitForTimeout(1500);
await p.getByTestId("pos-rail-comensal").click(); await p.waitForTimeout(1200);
await p.getByTestId("pos-guest-history-q").fill("Empresa"); await p.waitForTimeout(1200);
const res = await p.locator('[data-testid^="pos-guest-history-pick-"]').allTextContents(); console.log("search:", res);
await p.locator('[data-testid^="pos-guest-history-pick-"]').first().click(); await p.waitForTimeout(1500);
console.log("profile:", (await p.getByTestId("pos-guest-history-profile").innerText()).replace(/\n/g," | "));
await p.screenshot({ path: "/tmp/pos50.png" });
await p.keyboard.press("Escape"); await p.waitForTimeout(500);
// Now Datos factura prompt should be prefilled
await p.getByTestId("pos-rail-cliente").click(); await p.waitForTimeout(1200);
console.log("name:", await p.getByTestId("pos-customer-customerName").inputValue(), "| nif:", await p.getByTestId("pos-customer-customerTaxId").inputValue(), "| summary:", await p.getByTestId("pos-customer-summary").textContent());
await p.screenshot({ path: "/tmp/pos51.png" });
await b.close();
