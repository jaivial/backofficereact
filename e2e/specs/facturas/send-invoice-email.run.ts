/**
 * E2E: create an invoice through the UI and send it by email (with PDF attached)
 * to a real inbox. Credentials are read from backend/.env (BOOTSTRAP_ADMIN_*).
 *
 * Run: BACKOFFICE_URL=https://localhost:3006 bun run e2e/specs/facturas/send-invoice-email.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3006";
const RECIPIENT = process.env.INVOICE_TEST_EMAIL || "jaimebillanueba99@gmail.com";

function readEnvCreds(): { email: string; password: string } {
  const envPath = path.resolve(process.cwd(), "../backend/.env");
  let email = process.env.E2E_ADMIN_EMAIL || "";
  let password = process.env.E2E_ADMIN_PASSWORD || "";
  try {
    const raw = fs.readFileSync(envPath, "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (k === "BOOTSTRAP_ADMIN_EMAIL" && !email) email = v.trim();
      if (k === "BOOTSTRAP_ADMIN_PASSWORD" && !password) password = v.trim();
    }
  } catch {
    /* fall back to env */
  }
  return { email, password };
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 20_000 });
}

async function main(): Promise<void> {
  const { email, password } = readEnvCreds();
  if (!email || !password) throw new Error("No credentials found in backend/.env");
  console.log(`Using credentials: ${email}`);

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Surface network failures for the send call.
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/admin/invoices")) {
      console.log(`  [net] ${res.request().method()} ${u.replace(BASE_URL, "")} -> ${res.status()}`);
    }
  });

  try {
    console.log("1. Logging in...");
    await login(page, email, password);

    console.log("2. Opening Añadir form...");
    await page.goto(`${BASE_URL}/app/facturas?tab=${encodeURIComponent("añadir")}`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
    await page.waitForSelector('[data-testid="invoice-client-input"]', { timeout: 15_000 });

    console.log("3. Filling customer + line items + template...");
    await page.fill('[data-testid="invoice-client-input"]', "Jaime");
    await page.fill('[data-testid="invoice-surname-input"]', "Villanueva");
    await page.fill('[data-testid="invoice-email-input"]', RECIPIENT);

    // Enable line items and add one
    await page.click('[data-testid="invoice-line-items-toggle"]');
    const addFirst = page.locator('[data-testid="line-item-add-first-button"]');
    if (await addFirst.count()) {
      await addFirst.click();
    } else {
      await page.click('[data-testid="line-item-add-button"]');
    }
    await page.fill('[data-testid="line-item-description-0"]', "Menú degustación");
    await page.fill('[data-testid="line-item-quantity-0"]', "2");
    await page.fill('[data-testid="line-item-unit-price-0"]', "40");
    await page.fill('[data-testid="line-item-iva-rate-0"]', "21");

    // Select the modern PDF template (click the card label; the radio is hidden)
    const modernCard = page.locator('[data-ui="pdf-template-option-modern"]');
    if (await modernCard.count()) {
      await modernCard.scrollIntoViewIfNeeded();
      await modernCard.click();
    }

    console.log("4. Clicking 'Enviar factura' (create + send)...");
    const submit = page.locator('[data-testid="invoice-submit-btn"]');
    await submit.scrollIntoViewIfNeeded();
    await submit.click();

    console.log("5. Waiting for result toast...");
    const okToast = page.locator('[data-ui="toast-title"]', { hasText: /enviada|guardad/i });
    const errToast = page.locator('[data-ui="toast-title"]', { hasText: /error/i });
    const result = await Promise.race([
      okToast.first().waitFor({ timeout: 30_000 }).then(() => "ok"),
      errToast.first().waitFor({ timeout: 30_000 }).then(() => "err"),
    ]).catch(() => "timeout");

    const title = (await page.locator('[data-ui="toast-title"]').first().textContent().catch(() => "")) || "";
    const msg = (await page.locator('[data-ui="toast-message"]').first().textContent().catch(() => "")) || "";
    console.log(`   toast: "${title.trim()}" — "${msg.trim()}"`);

    await page.screenshot({ path: "e2e/screenshots/send-invoice-email.png" });

    if (result === "ok" && /enviada/i.test(title + msg)) {
      console.log("\nRESULT: PASS — invoice created and sent by email.");
    } else {
      console.log(`\nRESULT: FAIL (${result})`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
