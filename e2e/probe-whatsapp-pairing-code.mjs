import { chromium } from "@playwright/test";

/**
 * Debug: pairing-code flow ("Conectar con código" modal) with named checkpoints.
 *
 * Every WhatsApp API request is tagged with X-Correlation-ID (CID). Output is
 * structured as greppable checkpoints:
 *   [CP01_LOGIN] ... [CP02_NAV] ... [CP03_RESET] ... [CP04_MODAL]
 *   [CP05_PHONE] [CP06_CONNECT_POST] [CP07_UI_TIMELINE] [CP08_WS] [CP09_VERDICT]
 *
 * Target bug: POST /connect (phone) sometimes answers pair_code=null qr=null
 * status=connecting and the UI never shows a code. The timeline keeps sampling
 * UI + WS frames for 75s so webhook-delivered QRs/codes are observed too.
 */
const BASE = process.env.BASE_URL || "https://backoffice.alqueriavillacarmen.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const PHONE = process.env.PAIR_PHONE || "34960255536";
const OBSERVE_MS = Number(process.env.OBSERVE_MS || 75_000);

const RUN_ID = Math.random().toString(36).slice(2, 10);
let seq = 0;
const cid = () => `${RUN_ID}-${String(++seq).padStart(3, "0")}`;
const ts = () => new Date().toISOString().slice(11, 23);
const log = (...a) => console.log(`[${ts()}]`, ...a);
const t0 = Date.now();
const since = () => `+${((Date.now() - t0) / 1000).toFixed(1)}s`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1200 } });
const page = await ctx.newPage();

// Tag every same-origin whatsapp API fetch with a correlation id
await page.addInitScript(() => {
  const orig = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input.url;
      if (url.includes("/api/admin/members/whatsapp")) {
        init = init || {};
        init.headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
        init.headers.set("X-Correlation-ID", window.__cid());
      }
    } catch {}
    return orig.call(this, input, init);
  };
});
await page.addInitScript(() => {
  let n = 0;
  const rid = Math.random().toString(36).slice(2, 10);
  window.__cid = () => `${rid}-${String(++n).padStart(3, "0")}`;
});

const consoleErrs = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => consoleErrs.push("pageerror: " + e.message.slice(0, 160)));

const wsFrames = [];
page.on("websocket", (ws) => {
  ws.on("framereceived", (f) => {
    try {
      const p = JSON.parse(f.payload);
      if (p.type === "whatsapp.connection") {
        const entry = `${since()} WS pair=${JSON.stringify(p.connection?.pair_code)} qr=${p.connection?.qr ? `yes(len=${p.connection.qr.length})` : "no"} status=${p.connection?.status} connected=${p.connected}`;
        wsFrames.push(entry);
        log(`[WS_FRAME] ${entry}`);
      }
    } catch {}
  });
});

page.on("request", (req) => {
  if (req.url().includes("/api/admin/members/whatsapp")) {
    log(`[API_REQ] CID=${req.headers()["x-correlation-id"] ?? "(none)"} >> ${req.method()} ${new URL(req.url()).pathname}${new URL(req.url()).search} body=${req.postData() ?? "-"}`);
  }
});
page.on("response", async (res) => {
  if (!res.url().includes("/api/admin/members/whatsapp") || res.request().resourceType() === "websocket") return;
  let parsed = {};
  try { parsed = JSON.parse(await res.text()); } catch {}
  log(`[API_RES] CID=${res.request().headers()["x-correlation-id"] ?? "(none)"} << ${res.status()} ${new URL(res.url()).pathname} success=${parsed.success} pair=${JSON.stringify(parsed.connection?.pair_code ?? parsed.pair_code)} qr=${parsed.connection?.qr ? `yes(len=${parsed.connection.qr.length})` : "no"} status=${parsed.connection?.status} msg=${JSON.stringify(parsed.message ?? parsed.error ?? "")}`);
});

const uiSnapshot = async () => {
  const state = await section.getAttribute("data-state").catch(() => "?");
  const codeEl = section.locator(".bo-pairCode");
  const codeCount = await codeEl.count();
  const uiCode = codeCount ? (await codeEl.first().textContent())?.trim() : null;
  const qrCount = await section.locator("img.bo-qr").count();
  const natW = qrCount ? await section.locator("img.bo-qr").first().evaluate((el) => el.naturalWidth) : null;
  return { state, uiCode, qrCount, natW };
};

// CP01: login
await page.goto(BASE, { waitUntil: "load", timeout: 45_000 });
const loginStatus = await page.evaluate(async ({ url, email, password }) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Correlation-ID": "login" }, body: JSON.stringify({ identifier: email, password }), credentials: "include" });
  return r.status;
}, { url: `${BASE}/api/admin/login`, email: EMAIL, password: PASSWORD });
log(`[CP01_LOGIN] ${loginStatus === 200 ? "OK" : "FAIL"} status=${loginStatus}`);

// CP02: navigate to Contacto tab
await page.goto(`${BASE}/app/config?content=contacto`, { waitUntil: "networkidle", timeout: 45_000 });
const section = page.locator('[data-ui="whatsapp-connection"]');
await section.waitFor({ state: "visible", timeout: 15_000 });
const initState = await section.getAttribute("data-state");
log(`[CP02_NAV] OK whatsapp panel visible, initial data-state=${initState}`);

// CP03: reset to disconnected so the pairing buttons are present
if (initState !== "disconnected") {
  const cancel = section.locator('button[aria-label="Cancelar vinculación"]');
  if (await cancel.isVisible().catch(() => false)) {
    await cancel.click();
    await page.waitForTimeout(4000);
  }
}
const resetState = await section.getAttribute("data-state");
log(`[CP03_RESET] data-state=${resetState} ${resetState === "disconnected" ? "OK" : "WARN still not disconnected"}`);

// CP04: open pairing modal
const pairBtn = section.locator('button[aria-label="Conectar WhatsApp con código de vinculación"]');
if (!(await pairBtn.isVisible().catch(() => false))) {
  log(`[CP04_MODAL] FAIL pairing button not visible, state=${await section.getAttribute("data-state")}`);
  await section.screenshot({ path: "/tmp/wa-pairing-fatal.png" });
  await browser.close();
  process.exit(1);
}
await pairBtn.click();
const phoneInput = page.locator("#whatsapp-pairing-phone");
await phoneInput.waitFor({ state: "visible", timeout: 10_000 });
log(`[CP04_MODAL] OK modal open`);

// CP05: fill phone
await phoneInput.fill(PHONE);
const modalErr = await page.locator("#whatsapp-pairing-error").textContent().catch(() => null);
log(`[CP05_PHONE] filled=${PHONE} modalError=${JSON.stringify(modalErr?.trim() ?? null)}`);

// CP06: Generar código -> capture POST /connect
const connectResp = page.waitForResponse(
  (r) => r.url().includes("/members/whatsapp/connect") && r.request().method() === "POST",
  { timeout: 90_000 },
);
await page.getByRole("button", { name: "Generar código" }).click();
const res = await connectResp;
let body = {};
try { body = await res.json(); } catch {}
const respPair = body?.connection?.pair_code ?? null;
const respQr = body?.connection?.qr ?? null;
log(`[CP06_CONNECT_POST] CID=${res.request().headers()["x-correlation-id"] ?? "?"} http=${res.status()} success=${body?.success} pair=${JSON.stringify(respPair)} qr=${respQr ? `yes(len=${respQr.length})` : "no"} status=${body?.connection?.status} msg=${JSON.stringify(body?.message)}`);
log(`[CP06_CONNECT_POST] ${!respPair && !respQr ? "NULL_RESPONSE: backend got neither code nor QR from provider — watching for webhook delivery..." : "provider returned data inline"}`);

// CP07: UI timeline until code/qr show or OBSERVE_MS elapses
let sawCodeAt = null;
let sawQrAt = null;
let lastSnap = null;
const deadline = Date.now() + OBSERVE_MS;
let i = 0;
while (Date.now() < deadline) {
  i++;
  await page.waitForTimeout(2500);
  lastSnap = await uiSnapshot();
  if (lastSnap.uiCode && !sawCodeAt) sawCodeAt = since();
  if (lastSnap.qrCount > 0 && sawQrAt === null) sawQrAt = since();
  log(`[CP07_UI_TIMELINE] ${since()} tick=${i} state=${lastSnap.state} pairCode=${JSON.stringify(lastSnap.uiCode)} qrImg=${lastSnap.qrCount} natW=${lastSnap.natW}`);
  if (lastSnap.state === "connected") break;
}
log(`[CP07_UI_TIMELINE] summary: codeFirstSeen=${sawCodeAt ?? "never"} qrFirstSeen=${sawQrAt ?? "never"} finalState=${lastSnap?.state}`);

// CP08: WS frames recap
log(`[CP08_WS] ${wsFrames.length} connection frames:`);
wsFrames.forEach((f) => log(`[CP08_WS]   ${f}`));
log(`[CP08_WS] console errors: ${consoleErrs.length ? JSON.stringify(consoleErrs.slice(0, 5)) : "(none)"}`);

// CP09: verdict
const fin = await uiSnapshot();
const verdict = fin.uiCode
  ? "OK: pairing code displayed"
  : respPair
    ? "BUG-A: backend returned a code but UI lost it (state machine/render)"
    : !respPair && !respQr
      ? sawCodeAt || sawQrAt
        ? `BUG-B: connect answered empty but provider delivered later via webhook at code=${sawCodeAt ?? "-"} qr=${sawQrAt ?? "-"} (initial UX gap)`
        : "BUG-C: connect answered empty and NOTHING ever arrived (webhook/provider black hole)"
      : "QR-only response, no code — provider gave no pairingCode";
log(`[CP09_VERDICT] ${verdict} | final: state=${fin.state} pairCode=${JSON.stringify(fin.uiCode)} qrImg=${fin.qrCount}`);

await section.screenshot({ path: `/tmp/wa-pairing-final-${RUN_ID}.png` });
await browser.close();
