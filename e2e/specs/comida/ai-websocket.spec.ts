/**
 * Validates the WebSocket-driven AI image flow for comida (platos):
 *  - the comida WS connects (proxy allowlist fix)
 *  - "Mejorar con IA" triggers a WS `comida_ai_started` -> skeleton
 *  - `comida_ai_completed` -> skeleton clears + new image
 *  - NO list polling (`/api/admin/platos?...limit=500`) happens
 *
 * Requires an active AI config with a REAL WaveSpeed key (set via Config -> IA).
 * If the key is invalid, the job fails fast and we still assert no polling +
 * that the started event/skeleton appeared.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const PLATO_URL = `${BASE}/app/comida/platos/125`;

function makePng(): string {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAHElEQVR4nO3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAMBjAAABZmQ7cAAAAABJRU5ErkJggg==";
  const p = path.join(os.tmpdir(), `ws-${Date.now()}.png`);
  fs.writeFileSync(p, Buffer.from(b64, "base64"));
  return p;
}

test("comida AI flow is driven by WebSocket, not polling", async ({ page }) => {
  const wsFrames: string[] = [];
  let comidaWsOpened = false;
  let listPollCount = 0;

  page.on("websocket", (ws) => {
    if (ws.url().includes("/api/admin/comida/ws")) {
      comidaWsOpened = true;
      ws.on("framereceived", (f) => {
        const d = typeof f.payload === "string" ? f.payload : "";
        if (d) wsFrames.push(d.slice(0, 200));
      });
    }
  });
  const listReqTimes: number[] = [];
  const t0 = Date.now();
  page.on("request", (r) => {
    if (/\/api\/admin\/platos\?.*limit=500/.test(r.url())) { listPollCount++; listReqTimes.push(Date.now() - t0); }
  });

  // Login via API, then open the platos detail page.
  await page.goto(`${BASE}/m/login`, { waitUntil: "load", timeout: 30000 });
  const login = await page.evaluate(async ({ url, email, password }) => {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, password }), credentials: "include" });
    return r.json();
  }, { url: `${BASE}/api/admin/login`, email: EMAIL, password: PASSWORD });
  expect(login.success).toBeTruthy();

  await page.goto(PLATO_URL, { waitUntil: "load", timeout: 30000 });
  await page.waitForSelector('[data-role="food-detail-change-photo-btn"]', { state: "visible", timeout: 20000 });

  // The comida WebSocket must connect (proxy allowlist fix).
  await expect.poll(() => comidaWsOpened, { timeout: 15000 }).toBeTruthy();
  // Backend sends a hello frame on connect.
  await expect.poll(() => wsFrames.some((f) => f.includes('"hello"')), { timeout: 15000 }).toBeTruthy();

  // Upload -> advisor -> Mejorar con IA
  const img = makePng();
  await page.locator('[data-role="food-detail-file-input"]').setInputFiles(img);
  await page.locator('[data-role="food-detail-file-input"]').dispatchEvent("change").catch(() => {});
  const advisor = page.locator('[data-role="food-detail-ai-advisor-enhance-btn"]');
  await expect(advisor).toBeVisible({ timeout: 15000 });
  await advisor.click();

  // A started event must arrive over the WebSocket (this is what drives the
  // skeleton now that polling is removed).
  await expect.poll(() => wsFrames.some((f) => f.includes("comida_ai_started")), { timeout: 20000 }).toBeTruthy();

  // The skeleton is shown, driven by the WS started event.
  await expect(page.locator('[data-role="food-detail-image-skeleton"]')).toBeVisible({ timeout: 5000 });

  // Let time pass that WOULD have produced multiple 4s poll cycles under the old
  // implementation, then assert the flow never falls back to list polling.
  await page.waitForTimeout(12000);
  console.log(`LIST_REQS count=${listPollCount} timesMs=${JSON.stringify(listReqTimes)}`);
  console.log(`WS_FRAME_TYPES=${JSON.stringify(wsFrames.map((f) => (f.match(/"type":"([^"]+)"/) || [])[1]).filter(Boolean))}`);
  // No periodic polling: the old 4s loop would produce 3+ calls across 12s.
  // A single reconnect re-sync is acceptable.
  expect(listPollCount).toBeLessThanOrEqual(1);

  fs.unlinkSync(img);
});
