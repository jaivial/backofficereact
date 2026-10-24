import { chromium } from "@playwright/test";
const b = await chromium.connectOverCDP("http://127.0.0.1:9362");
const p = b.contexts()[0].pages().find(x=>x.url().includes("3098"));
await p.goto("http://127.0.0.1:3098/app/pos", { waitUntil: "networkidle" }); await p.waitForTimeout(2500);
await p.getByTestId("pos-open-visit-" + (await p.evaluate(()=>[...document.querySelectorAll('[data-testid^="pos-open-visit-"]')].map(e=>e.dataset.testid.split('-').pop())[0]))).click(); await p.waitForTimeout(1500);
// add a dish, send to kitchen via rail, then void it
await p.getByRole("button", { name: /^Añadir Arroz del señoret$/ }).click(); await p.waitForTimeout(1200);
console.log("badge before send:", await p.getByTestId("pos-rail-badge-cocina").textContent().catch(()=>null));
await p.getByTestId("pos-rail-cocina").click(); await p.waitForTimeout(2000);
console.log("msg:", await p.getByTestId("pos-message").textContent(), "| err:", await p.getByTestId("pos-error").textContent());
console.log("badge after send:", await p.getByTestId("pos-rail-badge-cocina").count());
await p.screenshot({ path: "/tmp/pos46.png" });
// void the sent dish
const voidBtn = p.locator('.pos-line', { hasText: "Arroz del señoret" }).locator('.pos-line__void');
await voidBtn.click(); await p.waitForTimeout(800);
await p.getByRole("button", { name: "Anular", exact: true }).click(); await p.waitForTimeout(1500);
// PIN challenge (threshold 10€, dish 15€)
if (await p.getByTestId("pos-pin-key-1").count()) { for (const d of "1234") await p.getByTestId(`pos-pin-key-${d}`).click(); await p.getByRole("button", { name: "Aprobar con PIN" }).click(); await p.waitForTimeout(2500); }
console.log("msg:", await p.getByTestId("pos-message").textContent(), "| err:", await p.getByTestId("pos-error").textContent());
await b.close();
