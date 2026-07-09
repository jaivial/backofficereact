/**
 * Debug: Mobile bottom-nav 500 error when navigating from wine detail page
 *
 * This test reproduces the reported bug where navigating FROM
 * /app/comida/vinos/39 using the mobile bottom navbar causes
 * the destination page to load with a 500 error.
 *
 * Run with:
 *   E2E_ADMIN_EMAIL="admin@villacarmen.com" E2E_ADMIN_PASSWORD="admin123" \
 *   BACKOFFICE_URL="https://localhost:3010" \
 *   npx playwright test e2e/specs/debug/mobile-nav-wine-500.spec.ts --reporter=list
 *
 * Or with UI mode for visual debugging:
 *   E2E_ADMIN_EMAIL="admin@villacarmen.com" E2E_ADMIN_PASSWORD="admin123" \
 *   BACKOFFICE_URL="https://localhost:3010" \
 *   npx playwright test e2e/specs/debug/mobile-nav-wine-500.spec.ts --ui
 */
import { test as base, expect, type Page } from "@playwright/test";
import { captureConsole, assertNoCriticalErrors } from "../../helpers/console";

const BASE_URL = process.env.BACKOFFICE_URL || "https://localhost:3010";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
const WINE_DETAIL_URL = "/app/comida/vinos/39";

/**
 * Login via the backoffice API endpoint and return the page with session cookie set.
 */
async function login(page: Page) {
  await page.goto(BASE_URL, { waitUntil: "load", timeout: 30_000 });

  const result = await page.evaluate(
    async ({ url, email, password }) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
          credentials: "include",
        });
        const data = await res.json();
        return { success: data.success, message: data.message, status: res.status };
      } catch (e) {
        return { success: false, message: `fetch error: ${(e as Error).message}`, status: 0 };
      }
    },
    { url: `${BASE_URL}/api/admin/login`, email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  );

  if (!result.success) {
    throw new Error(`Login failed: ${result.message}`);
  }

  await page.waitForTimeout(500);
}

/**
 * Mobile viewport — iPhone 12 (390×844).
 * This triggers the @media (max-width:720px) breakpoint.
 */
const MOBILE_VIEWPORT = { width: 390, height: 844 };

/**
 * Nav targets: all pages reachable from the sidebar mobile bottom nav.
 */
const NAV_TARGETS = [
  { name: "Backoffice", url: "/app/backoffice" },
  { name: "Reservas", url: "/app/reservas" },
  { name: "Menus", url: "/app/menus" },
  { name: "Comida", url: "/app/comida" },
  { name: "Miembros", url: "/app/miembros" },
  { name: "Fichaje", url: "/app/fichaje" },
  { name: "Horarios", url: "/app/horarios" },
  { name: "Facturas", url: "/app/facturas" },
  { name: "Config", url: "/app/config" },
  { name: "Settings", url: "/app/settings" },
];

/**
 * Control start pages — navigation from these should work fine.
 */
const CONTROL_START_PAGES = [
  { name: "Dashboard", url: "/app" },
  { name: "Comida list", url: "/app/comida" },
  { name: "Reservas list", url: "/app/reservas" },
];

// ── Fixture that extends base test with a logged-in page ────────────
const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: MOBILE_VIEWPORT,
    });
    const page = await context.newPage();
    await login(page);
    await use(page);
    await context.close();
  },
});

// ── Helper ──────────────────────────────────────────────────────────
async function navigateFromTo(
  page: Page,
  startUrl: string,
  targetUrl: string,
  label: string,
) {
  const consoleCapture = captureConsole(page);

  const serverErrors: Array<{ url: string; status: number; method: string; body: string }> = [];
  const onResponse = async (res: { url: () => string; status: () => number; request: () => { method: () => string }; text: () => Promise<string> }) => {
    if (res.status() >= 500) {
      let body = "";
      try { body = (await res.text()).slice(0, 400); } catch { body = "(unreadable)"; }
      serverErrors.push({ url: res.url(), status: res.status(), method: res.request().method(), body });
    }
  };
  page.on("response", onResponse);

  console.log(`\n── ${label} ──`);
  console.log(`  GET ${startUrl}`);

  await page.goto(startUrl, { waitUntil: "networkidle", timeout: 30_000 });

  if (page.url().includes("/login")) {
    console.log("  ⚠ Redirected to login — session may have expired");
    page.off("response", onResponse);
    return { serverErrors, consoleErrors: [] as string[], skipped: true };
  }

  const mobileNav = page.locator('[data-testid="sidebar-nav-mobile"]');
  const desktopNav = page.locator('[data-testid="sidebar-nav-desktop"]');
  console.log(`  desktop-nav visible: ${await desktopNav.isVisible().catch(() => false)}`);
  console.log(`  mobile-nav  visible: ${await mobileNav.isVisible().catch(() => false)}`);

  await page.waitForTimeout(1000);

  // Navigate to target
  const link = mobileNav.locator(`a[href="${targetUrl}"]`);
  if ((await link.count()) > 0) {
    console.log(`  click → ${targetUrl}`);
    await Promise.all([
      page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => {}),
      link.first().click(),
    ]);
  } else {
    console.log(`  goto → ${targetUrl} (link not found in mobile nav)`);
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 20_000 });
  }

  await page.waitForTimeout(1500);

  const finalUrl = page.url();
  const errors = assertNoCriticalErrors(consoleCapture);
  page.off("response", onResponse);

  console.log(`  → ${finalUrl}`);
  console.log(`  console critical: ${errors.criticalErrors.length}`);

  if (serverErrors.length) {
    console.log(`  🚨 500s:`);
    for (const e of serverErrors) {
      console.log(`    ${e.status} ${e.method} ${e.url}`);
      console.log(`    body: ${e.body.slice(0, 200)}`);
    }
  }

  const isErrorPage = await page.locator('[data-testid="error-page-primary-button"]').isVisible().catch(() => false);
  if (isErrorPage) {
    const code = await page.locator('[data-ui="error-status"]').textContent().catch(() => "?");
    console.log(`  ⚠ Error page shown (status ${code})`);
  }

  return {
    serverErrors,
    consoleErrors: errors.criticalErrors,
    skipped: false,
    finalUrl,
    server500Detected: serverErrors.length > 0,
    isErrorPage,
  };
}

// ── Tests ───────────────────────────────────────────────────────────
test.describe("Mobile bottom-nav 500 — debug", () => {
  test.setTimeout(300_000);

  test.describe("SCENARIO: FROM wine detail page", () => {
    for (const target of NAV_TARGETS) {
      test(`→ ${target.name}`, async ({ loggedInPage }) => {
        const r = await navigateFromTo(loggedInPage, WINE_DETAIL_URL, target.url, `🍷 wine → ${target.name}`);
        expect(r.skipped).toBe(false);
      });
    }
  });

  test.describe("CONTROL: FROM normal pages", () => {
    for (const start of CONTROL_START_PAGES) {
      for (const target of NAV_TARGETS.slice(0, 4)) {
        test(`${start.name} → ${target.name}`, async ({ loggedInPage }) => {
          const r = await navigateFromTo(loggedInPage, start.url, target.url, `✓ ${start.name} → ${target.name}`);
          expect(r.skipped).toBe(false);
        });
      }
    }
  });

  test.describe("DEEP DEBUG: raw request trace", () => {
    test("wine → reservas (with Vike data requests)", async ({ loggedInPage }) => {
      const page = loggedInPage;
      await page.setViewportSize(MOBILE_VIEWPORT);

      interface Req { url: string; method: string; status: number; ok: boolean; ts: number }
      const allReqs: Req[] = [];

      page.on("request", (req) => {
        allReqs.push({ url: req.url(), method: req.method(), status: 0, ok: false, ts: Date.now() });
      });
      page.on("response", (res) => {
        const match = allReqs.find(r => r.url === res.url() && r.status === 0);
        if (match) { match.status = res.status(); match.ok = res.ok(); }
      });

      // Load wine detail
      await page.goto(WINE_DETAIL_URL, { waitUntil: "networkidle", timeout: 30_000 });
      console.log(`\nLoaded ${WINE_DETAIL_URL} → ${page.url()}`);
      await page.waitForTimeout(2000);

      // Click Reservas in mobile nav
      const mobileNav = page.locator('[data-testid="sidebar-nav-mobile"]');
      if (await mobileNav.isVisible().catch(() => false)) {
        const link = mobileNav.locator('a[href="/app/reservas"]');
        if ((await link.count()) > 0) {
          console.log("Clicking 'Reservas' link…");
          await link.first().click();
          await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
          await page.waitForTimeout(2000);
        }
      }

      // Report
      console.log("\n═══════════════════════════════════");
      console.log("REQUEST TRACE");
      console.log("═══════════════════════════════════");

      const failed = allReqs.filter(r => !r.ok && r.status !== 0);
      const vike = allReqs.filter(r => r.url.includes(".pageContext") || r.url.includes("_vike/data") || r.url.includes("?vike"));
      const fiveHundreds = allReqs.filter(r => r.status >= 500);

      if (fiveHundreds.length) {
        console.log(`\n🚨 5xx responses (${fiveHundreds.length}):`);
        for (const r of fiveHundreds) console.log(`  ${r.status} ${r.method} ${r.url}`);
      }
      if (vike.length) {
        console.log(`\n📦 Vike data fetches (${vike.length}):`);
        for (const r of vike) console.log(`  ${r.status} ${r.method} ${r.url}`);
      }
      if (failed.length) {
        console.log(`\n❌ Failed (${failed.length}):`);
        for (const r of failed) console.log(`  ${r.status} ${r.method} ${r.url}`);
      }

      console.log(`\n📍 Final URL: ${page.url()}`);
      const errorBtn = page.locator('[data-testid="error-page-primary-button"]');
      console.log(`   Error page visible: ${await errorBtn.isVisible().catch(() => false)}`);

      await page.screenshot({ path: `test-results/artifacts/debug-wine500-${Date.now()}.png` });
    });
  });
});
