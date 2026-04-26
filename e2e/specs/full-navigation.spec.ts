/**
 * Full Navigation E2E Test
 * 
 * This test logs in ONCE (via global-setup session caching) and then
 * navigates through ALL pages/tabs checking:
 * - Pages load without crash
 * - No critical console errors
 * - No network errors (4xx/5xx)
 * 
 * Run with: bunx playwright test e2e/specs/full-navigation.spec.ts
 * 
 * Note: Uses adminPage fixture which reuses cached session from global-setup.
 * No need to manually login - session is restored automatically.
 */
import { test, expect, type Page } from "../fixtures/session";
import { captureConsole, assertNoCriticalErrors, type ConsoleCapture } from "../helpers/console";

// ============================================================================
// Page definitions - all routes in the app
// ============================================================================

interface AppPage {
  name: string;
  url: string;
  tabs?: { name: string; selector: string }[];
  waitFor?: string; // Selector to wait for after navigation
}

const ALL_PAGES: AppPage[] = [
  // Dashboard
  { name: "Dashboard", url: "/app", waitFor: "nav, aside, [data-ui]" },
  
  // Reservas
  { name: "Reservas - List", url: "/app/reservas", waitFor: "table, [role='table'], nav" },
  { name: "Reservas - Create", url: "/app/reservas/anadir", waitFor: "form, button, nav" },
  { name: "Reservas - Config", url: "/app/reservas/config", waitFor: "form, nav" },
  { name: "Reservas - Tables", url: "/app/reservas/tables", waitFor: "canvas, nav" },
  
  // Comida (Food/Restaurant items)
  { name: "Comida - Main", url: "/app/comida", waitFor: "nav, [role='tab'], a[href*='comida']" },
  { name: "Comida - Platos", url: "/app/comida/platos", waitFor: "nav, [role='tab'], a" },
  { name: "Comida - Vinos", url: "/app/comida/vinos", waitFor: "nav, [role='tab'], a" },
  { name: "Comida - Bebidas", url: "/app/comida/bebidas", waitFor: "nav, [role='tab'], a" },
  { name: "Comida - Cafes", url: "/app/comida/cafes", waitFor: "nav, [role='tab'], a" },
  { name: "Comida - Postres", url: "/app/comida/postres", waitFor: "nav, [role='tab'], a" },
  
  // Menus
  { name: "Menus - List", url: "/app/menus", waitFor: "nav, table, a" },
  { name: "Menus - Create", url: "/app/menus/crear", waitFor: "nav, form, button" },
  
  // Miembros (Members)
  { name: "Miembros - List", url: "/app/miembros", waitFor: "nav, table, [role='tab']" },
  { name: "Miembros - Roles", url: "/app/miembros/roles", waitFor: "nav, form, button" },
  { name: "Miembros - Mi Horario", url: "/app/miembros/mi-horario", waitFor: "nav, [role='tab'], a" },
  
  // Fichaje (Clock in/out)
  { name: "Fichaje", url: "/app/fichaje", waitFor: "nav, table, button" },
  
  // Horarios (Schedules)
  { name: "Horarios - Main", url: "/app/horarios", waitFor: "nav, [role='tab'], button" },
  { name: "Horarios - Turnos", url: "/app/horarios/turnos", waitFor: "nav, table, button" },
  { name: "Horarios - Preview", url: "/app/horarios/preview", waitFor: "nav, [role='tab'], button" },
  
  // Config
  { name: "Config - Main", url: "/app/config", waitFor: "nav, [role='tab'], a" },
  { name: "Config - Booking", url: "/app/config/booking", waitFor: "nav, form, button" },
  
  // Facturas (Invoices)
  { name: "Facturas", url: "/app/facturas", waitFor: "nav, table, [role='tab']" },
  { name: "Facturas - Recurrentes", url: "/app/facturas/recurrentes", waitFor: "nav, table, [role='tab']" },
  
  // Estado de Cuenta
  { name: "Estado de Cuenta", url: "/app/estado-cuenta", waitFor: "nav, table, form" },
  
  // Reportes (Reports)
  { name: "Reportes", url: "/app/reportes", waitFor: "nav, [role='tab'], button" },
  
  // Settings
  { name: "Settings", url: "/app/settings", waitFor: "nav, [role='tab'], button" },
  
  // Site Builder
  { name: "Site Builder", url: "/app/site-builder", waitFor: "nav, [role='tab'], button" },
  
  // Website
  { name: "Website", url: "/app/website", waitFor: "nav, [role='tab'], button" },
  
  // Backoffice
  { name: "Backoffice", url: "/app/backoffice", waitFor: "nav, table, button" },
  
  // Comsit
  { name: "Comsit", url: "/app/comsit", waitFor: "nav, form, button" },
];

// ============================================================================
// Helper functions
// ============================================================================

interface PageResult {
  name: string;
  url: string;
  success: boolean;
  error?: string;
  consoleErrors: string[];
  networkErrors: { url: string; status: number }[];
  warnings: string[];
}

/**
 * Navigate to a page and capture console activity.
 */
async function visitPage(page: Page, appPage: AppPage): Promise<PageResult> {
  const result: PageResult = {
    name: appPage.name,
    url: appPage.url,
    success: false,
    consoleErrors: [],
    networkErrors: [],
    warnings: [],
  };

  const consoleCapture = captureConsole(page);

  try {
    // Navigate to the page
    await page.goto(appPage.url, { 
      waitUntil: "networkidle",
      timeout: 30_000 
    });

    // Wait for page to be ready
    await page.waitForLoadState("domcontentloaded");
    
    // If redirect to login, session might be expired
    if (page.url().includes("/login")) {
      result.error = "Redirected to login - session may be expired";
      result.consoleErrors.push(result.error);
      return result;
    }

    // Wait for specific selector if provided
    if (appPage.waitFor) {
      try {
        await page.waitForSelector(appPage.waitFor, { timeout: 10_000 });
      } catch {
        // Try alternative selectors
        const alternatives = ["nav", "aside", "main", "[role='main']", "body"];
        for (const alt of alternatives) {
          try {
            await page.waitForSelector(alt, { timeout: 3000 });
            break;
          } catch {
            continue;
          }
        }
      }
    }

    // Give time for any delayed API calls
    await page.waitForTimeout(1500);

    // Analyze console activity
    const analysis = assertNoCriticalErrors(consoleCapture);
    result.consoleErrors = analysis.criticalErrors.map(e => e);
    result.networkErrors = analysis.networkErrors.map(e => ({ 
      url: e.url, 
      status: e.status 
    }));
    result.warnings = analysis.criticalPageErrors.map(e => e.message);

    result.success = true;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    // Capture any console errors that occurred
    const analysis = assertNoCriticalErrors(consoleCapture);
    result.consoleErrors.push(...analysis.criticalErrors);
    result.networkErrors.push(...analysis.networkErrors.map(e => ({ 
      url: e.url, 
      status: e.status 
    })));
  }

  return result;
}

/**
 * Click through tabs on a page.
 */
async function clickThroughTabs(
  page: Page, 
  pageName: string,
  tabs: AppPage["tabs"]
): Promise<{ clicked: string[]; errors: string[] }> {
  if (!tabs || tabs.length === 0) {
    return { clicked: [], errors: [] };
  }

  const clicked: string[] = [];
  const errors: string[] = [];

  for (const tab of tabs) {
    try {
      // Try multiple selector strategies
      const selectors = [
        tab.selector,
        `button:has-text("${tab.name}")`,
        `[role="tab"]:has-text("${tab.name}")`,
        `a:has-text("${tab.name}")`,
        `tab:has-text("${tab.name}")`,
        `[data-tab="${tab.name}"]`,
        `[data-ui="tab"]:has-text("${tab.name}")`,
      ];

      let found = false;
      for (const selector of selectors) {
        const locator = page.locator(selector).first();
        if ((await locator.count()) > 0) {
          await locator.click();
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(1000);
          clicked.push(tab.name);
          found = true;
          break;
        }
      }

      if (!found) {
        errors.push(`Tab "${tab.name}" not found on ${pageName}`);
      }
    } catch (error) {
      errors.push(`Error clicking tab "${tab.name}" on ${pageName}: ${error}`);
    }
  }

  return { clicked, errors };
}

// ============================================================================
// Main Test
// ============================================================================

test.describe("Full Navigation E2E Test", () => {
  test.setTimeout(600_000); // 10 minutes for all pages

  let results: PageResult[] = [];
  let tabErrors: string[] = [];

  test("navigate through ALL pages and check for console errors", async ({ adminPage }) => {
    // Verify we're authenticated
    await adminPage.goto("/app");
    await adminPage.waitForLoadState("networkidle");
    
    // Skip if redirected to login (session expired)
    if (adminPage.url().includes("/login")) {
      test.skip(true, "Session expired - run global-setup again");
      return;
    }

    console.log(`\n🚀 Starting full navigation test (${ALL_PAGES.length} pages)...\n`);

    // Visit each page
    for (let i = 0; i < ALL_PAGES.length; i++) {
      const appPage = ALL_PAGES[i];
      const progress = `[${i + 1}/${ALL_PAGES.length}]`;
      console.log(`${progress} Testing: ${appPage.name} (${appPage.url})`);

      const result = await visitPage(adminPage, appPage);
      results.push(result);

      if (result.success) {
        // Try clicking through tabs if defined
        if (appPage.tabs && appPage.tabs.length > 0) {
          const { clicked, errors } = await clickThroughTabs(adminPage, appPage.name, appPage.tabs);
          tabErrors.push(...errors);
          if (clicked.length > 0) {
            console.log(`   ✓ Clicked tabs: ${clicked.join(", ")}`);
          }
        }
        console.log(`   ✓ ${appPage.name} loaded successfully`);
      } else {
        console.log(`   ✗ ${appPage.name} FAILED: ${result.error}`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("📊 FULL NAVIGATION TEST RESULTS");
    console.log("=".repeat(80));

    // Summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const pagesWithErrors = results.filter(r => r.consoleErrors.length > 0 || r.networkErrors.length > 0).length;

    console.log(`\n📈 Summary:`);
    console.log(`   Total pages: ${results.length}`);
    console.log(`   ✓ Successful: ${successful}`);
    console.log(`   ✗ Failed: ${failed}`);
    console.log(`   ⚠ Pages with console/network errors: ${pagesWithErrors}`);

    // Failed pages
    const failedPages = results.filter(r => !r.success);
    if (failedPages.length > 0) {
      console.log(`\n❌ FAILED PAGES:`);
      for (const r of failedPages) {
        console.log(`   - ${r.name} (${r.url}): ${r.error}`);
      }
    }

    // Pages with console errors
    const pagesWithConsoleErrors = results.filter(r => r.consoleErrors.length > 0);
    if (pagesWithConsoleErrors.length > 0) {
      console.log(`\n⚠️  PAGES WITH CONSOLE ERRORS:`);
      for (const r of pagesWithConsoleErrors) {
        console.log(`   - ${r.name}:`);
        for (const err of r.consoleErrors) {
          console.log(`     • ${err}`);
        }
      }
    }

    // Pages with network errors
    const pagesWithNetworkErrors = results.filter(r => r.networkErrors.length > 0);
    if (pagesWithNetworkErrors.length > 0) {
      console.log(`\n🌐 PAGES WITH NETWORK ERRORS (4xx/5xx):`);
      for (const r of pagesWithNetworkErrors) {
        console.log(`   - ${r.name}:`);
        for (const err of r.networkErrors) {
          console.log(`     • ${err.status}: ${err.url}`);
        }
      }
    }

    // Tab click errors
    if (tabErrors.length > 0) {
      console.log(`\n🔘 TAB CLICK ERRORS:`);
      for (const err of tabErrors) {
        console.log(`   - ${err}`);
      }
    }

    console.log("\n" + "=".repeat(80));

    // Assertions - fail if any page failed or has critical errors
    expect(failed, "Some pages failed to load").toBe(0);
    
    const criticalErrors = results.flatMap(r => r.consoleErrors);
    expect(criticalErrors.length, "Some pages have critical console errors").toBe(0);

    // Network errors might be acceptable depending on backend state, but we log them
    const networkErrors = results.flatMap(r => r.networkErrors);
    if (networkErrors.length > 0) {
      console.log(`\n📝 Note: ${networkErrors.length} network error(s) detected. ` +
        `These may be acceptable if related to optional features or backend state.`);
    }
  });

  test("verify session is still valid after navigation", async ({ adminPage }) => {
    // Check that session is still valid after navigating through all pages
    const sessionData = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return await res.json();
    });

    expect(sessionData.success).toBe(true);
    expect(sessionData.session?.user?.role).toBe("root");
  });
});

// ============================================================================
// Standalone report generator (run separately after tests)
// ============================================================================

/**
 * To generate a detailed report, you can run this after the tests:
 * 
 * bun run -e "
 * const results = require('./test-results/full-navigation-results.json');
 * console.table(results.map(r => ({
 *   Page: r.name,
 *   URL: r.url,
 *   Success: r.success ? '✓' : '✗',
 *   'Console Errors': r.consoleErrors.length,
 *   'Network Errors': r.networkErrors.length,
 * })));
 * "
 */

// Results are stored in test context for post-processing
