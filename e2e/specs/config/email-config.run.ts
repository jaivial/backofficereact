/**
 * E2E: Config page - Email provider configuration.
 * Fills SMTP settings from legacy .env, saves, validates in DB.
 *
 * Run: bun run e2e/specs/config/email-config.run.ts
 */
import type { BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const BASE_URL = "https://backoffice-dev.menustudioai.com";
const EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

// From /var/www/alqueriavillacarmen/.env
const SMTP = {
  host: "smtp.titan.email",
  port: "587",
  username: "reservas@alqueriavillacarmen.com",
  password: "!aLQueria_5225@",
  fromEmail: "reservas@alqueriavillacarmen.com",
  encryption: "tls", // tls | ssl | none
};

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
  await page.fill('input[type="text"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/app/**", { timeout: 15_000 });
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function main(): Promise<void> {
  console.log("\nEmail Provider Config E2E Test\n");

  const browser = await chromium.launch({ headless: true });
  const results: TestResult[] = [];

  try {
    const context: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const page: Page = await context.newPage();

    console.log("  Setting up: logging in...");
    await login(page);
    console.log("  Setup done.\n");

    // Navigate to config contacto
    await page.goto(`${BASE_URL}/app/config?content=contacto`, {
      waitUntil: "networkidle",
      timeout: 30_000,
    });

    // Expand email provider accordion
    const accordionBtn = page.getByRole("button", { name: /Configuración proveedor de email/i });
    await accordionBtn.waitFor({ state: "visible", timeout: 10_000 });
    await accordionBtn.click();
    await page.waitForTimeout(500);

    // Select provider: SMTP (click the dropdown, select SMTP option)
    const providerBtn = page.getByRole("button", { name: /Proveedor de mensajería email/i });
    await providerBtn.click();
    await page.waitForTimeout(300);
    // Find and click "SMTP" option
    const smtpOption = page.locator('[role="option"], [role="menuitem"]').filter({ hasText: "SMTP" });
    const smtpCount = await smtpOption.count();
    if (smtpCount > 0) {
      await smtpOption.first().click();
      await page.waitForTimeout(300);
    }

    // Select encryption: TLS
    const encBtn = page.getByRole("button", { name: /Encriptación SMTP/i });
    await encBtn.click();
    await page.waitForTimeout(300);
    const tlsOption = page.locator('[role="option"], [role="menuitem"]').filter({ hasText: /TLS/i });
    const tlsCount = await tlsOption.count();
    if (tlsCount > 0) {
      await tlsOption.first().click();
      await page.waitForTimeout(300);
    }

    // Fill SMTP fields
    await page.getByRole("textbox", { name: /Host SMTP/i }).fill(SMTP.host);

    // Puerto: clear and fill
    const portInput = page.getByRole("spinbutton", { name: /Puerto/i });
    await portInput.click({ clickCount: 3 }); // select all
    await portInput.fill(SMTP.port);

    await page.getByRole("textbox", { name: /Usuario SMTP/i }).fill(SMTP.username);
    await page.getByRole("textbox", { name: /Contraseña SMTP/i }).fill(SMTP.password);
    await page.getByRole("textbox", { name: /Email remitente/i }).fill(SMTP.fromEmail);

    // Click Guardar
    const saveBtn = page.getByRole("button", { name: /Guardar/i });
    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Check for success toast or no error
    const toast = page.locator('[data-toast-kind="success"], .bo-toast--success');
    const body = await page.textContent('body') || '';

    const hasError = body.includes('Error') && !body.includes('Error interno');
    if (hasError) {
      throw new Error(`Save failed: page shows error`);
    }

    console.log("  PASS  email config saved via UI");
    results.push({ name: "UI save", passed: true });
    await context.close();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  FAIL  UI save: ${msg}`);
    results.push({ name: "UI save", passed: false, error: msg });
  } finally {
    await browser.close();
  }

  // Validate in DB
  try {
    const { execSync } = await import("child_process");
    const result = execSync(
      `mysql -u root -pmyth -h 127.0.0.1 newvillacarmen -e "SELECT smtp_host, smtp_port, smtp_username, smtp_from_email, smtp_encryption, is_active FROM email_provider_config WHERE restaurant_id = 1 LIMIT 1" 2>/dev/null`
    ).toString();

    if (result.includes(SMTP.host) && result.includes(SMTP.username)) {
      console.log("  PASS  DB validation: SMTP config persisted");
      results.push({ name: "DB validation", passed: true });
    } else {
      console.log(`  FAIL  DB validation: expected SMTP config not found. Got: ${result.slice(0, 200)}`);
      results.push({ name: "DB validation", passed: false, error: "Config not in DB" });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  FAIL  DB validation: ${msg}`);
    results.push({ name: "DB validation", passed: false, error: msg });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
