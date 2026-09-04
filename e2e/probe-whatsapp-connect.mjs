import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const AUTO_CONNECT = process.env.AUTO_CONNECT !== "0"; // pass AUTO_CONNECT=0 to only observe

const consoleMsgs = [];
const waTraffic = [];
const isWA = (u) => u.includes("/api/admin/members/whatsapp");

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on("console", (m) => {
  if (["error", "warning"].includes(m.type())) consoleMsgs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => consoleMsgs.push(`[pageerror] ${e.message}`));
page.on("response", async (res) => {
  if (res.status() >= 400) console.log(`HTTP ${res.status}: ${res.request().method()} ${res.url()}`);
  if (!isWA(res.url()) || res.request().resourceType() === "websocket") return;
  let body = "(no body)";
  try { body = (await res.text()).slice(0, 1500); } catch {}
  waTraffic.push(`<< ${res.request().method()} ${res.url()} -> ${res.status()}\n   ${body}`);
});
page.on("request", (req) => {
  if (isWA(req.url()) && req.method() !== "GET") {
    waTraffic.push(`>> ${req.method()} ${req.url()}\n   body: ${req.postData() ?? "(none)"}`);
  }
});
// WebSocket frames to the connection hub
page.on("websocket", (ws) => {
  console.log(`WS OPEN: ${ws.url()}`);
  ws.on("framereceived", (f) => console.log(`WS << ${String(f.payload).slice(0, 600)}`));
  ws.on("close", () => console.log("WS CLOSED"));
});

// Login
await page.goto(BASE, { waitUntil: "load", timeout: 45_000 });
const login = await page.evaluate(async ({ url, email, password }) => {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
    credentials: "include",
  });
  return { status: r.status, data: await r.json().catch(() => null) };
}, { url: `${BASE}/api/admin/login`, email: EMAIL, password: PASSWORD });
console.log("LOGIN:", login.status, login.data?.success ? "ok" : JSON.stringify(login.data));

// Raw status probe
const probe = await page.evaluate(async (p) => {
  const r = await fetch(p, { credentials: "include" });
  return { status: r.status, body: await r.text().catch(() => "") };
}, `${BASE}/api/admin/members/whatsapp/connection`);
console.log("PROBE /connection:", probe.status, probe.body.slice(0, 800));

// Contacto tab (WhatsAppConnection lives in ConfigContacto)
await page.goto(`${BASE}/app/config?content=contacto`, { waitUntil: "networkidle", timeout: 45_000 });

const section = page.locator('[data-ui="whatsapp-connection"]');
const visible = await section.isVisible({ timeout: 15_000 }).catch(() => false);
console.log("SECTION visible:", visible);

if (visible) {
  const state = await section.getAttribute("data-state");
  console.log("SECTION data-state:", state);
  console.log("SECTION buttons:", JSON.stringify(await section.locator("button").allTextContents()));
  console.log("SECTION text:", (await section.textContent())?.replace(/\s+/g, " ").trim().slice(0, 400));

  if (state === "disconnected" && AUTO_CONNECT) {
    console.log("CLICKING Conectar con QR...");
    await section.locator('button[aria-label="Conectar WhatsApp"]').click();
    await page.waitForTimeout(15_000);
    console.log("AFTER data-state:", await section.getAttribute("data-state"));
    console.log("AFTER text:", (await section.textContent())?.replace(/\s+/g, " ").trim().slice(0, 500));
    console.log("QR imgs:", await section.locator("img.bo-qr").count());
    console.log("pair code:", (await section.locator(".bo-pairCode").textContent().catch(() => null))?.trim() ?? "(none)");
  }

  if (state === "qr_ready" && process.env.REGEN === "1") {
    console.log("CLICKING Regenerar QR...");
    await section.locator('button[aria-label="Regenerar QR"]').click();
    await page.waitForTimeout(15_000);
    console.log("AFTER REGEN data-state:", await section.getAttribute("data-state"));
    console.log("AFTER REGEN text:", (await section.textContent())?.replace(/\s+/g, " ").trim().slice(0, 500));
    console.log("QR imgs:", await section.locator("img.bo-qr").count());
    console.log("pair code:", (await section.locator(".bo-pairCode").textContent().catch(() => null))?.trim() ?? "(none)");
  }
} else {
  console.log("SECTION NOT RENDERED -> entitled !== true (component returns null)");
  console.log(
    "TAB text:",
    (await page.locator('[data-testid="config-section"]').textContent().catch(() => "(none)"))?.replace(/\s+/g, " ").slice(0, 600),
  );
}

console.log("=== WHATSAPP API TRAFFIC ===");
console.log(waTraffic.length ? waTraffic.join("\n") : "(none captured)");
console.log("=== CONSOLE ERRORS/WARNINGS ===");
console.log(consoleMsgs.length ? consoleMsgs.join("\n") : "(none)");

await page.screenshot({ path: "e2e/screenshots/debug-whatsapp-connect.png", fullPage: true });
await browser.close();
