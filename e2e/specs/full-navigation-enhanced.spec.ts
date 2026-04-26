/**
 * Enhanced Full Navigation E2E Test
 * 
 * This is an enhanced version that:
 * 1. Logs in ONCE (via global-setup session caching)
 * 2. Dynamically discovers tabs on each page
 * 3. Clicks through ALL discovered tabs
 * 4. Captures console/network errors on each page and tab
 * 5. Generates a detailed HTML report
 * 
 * Run with: bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts --reporter=list
 * 
 * For HTML report: bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts --reporter=html
 */
import { test, expect, type Page } from "../fixtures/session";
import { captureConsole, assertNoCriticalErrors, type ConsoleCapture } from "../helpers/console";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Configuration
// ============================================================================

interface PageConfig {
  name: string;
  url: string;
  // Selectors for tabs on this page (will try multiple strategies)
  tabSelectors?: string[];
  // Selectors to wait for after navigation
  readySelectors?: string[];
  // Skip this page?
  skip?: boolean;
}

const MAIN_PAGES: PageConfig[] = [
  { name: "Dashboard", url: "/app", readySelectors: ["nav", "aside", "[data-ui]"] },
  { name: "Reservas", url: "/app/reservas", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["table", "[role='table']"] },
  { name: "Reservas - Create", url: "/app/reservas/anadir", readySelectors: ["form"] },
  { name: "Reservas - Config", url: "/app/reservas/config", readySelectors: ["form", "button"] },
  { name: "Reservas - Tables", url: "/app/reservas/tables", readySelectors: ["canvas", "[role='application']"] },
  { name: "Comida", url: "/app/comida", tabSelectors: ["[role='tab']", "a[href*='comida']"], readySelectors: ["[role='tab'], a[href*='comida']"] },
  { name: "Comida - Platos", url: "/app/comida/platos", readySelectors: ["a, [role='tab'], button"] },
  { name: "Comida - Vinos", url: "/app/comida/vinos", readySelectors: ["a, [role='tab'], button"] },
  { name: "Comida - Bebidas", url: "/app/comida/bebidas", readySelectors: ["a, [role='tab'], button"] },
  { name: "Comida - Cafes", url: "/app/comida/cafes", readySelectors: ["a, [role='tab'], button"] },
  { name: "Comida - Postres", url: "/app/comida/postres", readySelectors: ["a, [role='tab'], button"] },
  { name: "Menus", url: "/app/menus", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["table, a"] },
  { name: "Menus - Create", url: "/app/menus/crear", readySelectors: ["form", "button"] },
  { name: "Miembros", url: "/app/miembros", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["table"] },
  { name: "Miembros - Roles", url: "/app/miembros/roles", readySelectors: ["form", "button"] },
  { name: "Miembros - Mi Horario", url: "/app/miembros/mi-horario", readySelectors: ["button, a"] },
  { name: "Fichaje", url: "/app/fichaje", readySelectors: ["table, button"] },
  { name: "Horarios", url: "/app/horarios", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["button, a"] },
  { name: "Horarios - Turnos", url: "/app/horarios/turnos", readySelectors: ["table, button"] },
  { name: "Horarios - Preview", url: "/app/horarios/preview", readySelectors: ["button, [role='tab']"] },
  { name: "Config", url: "/app/config", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["nav, aside"] },
  { name: "Config - Booking", url: "/app/config/booking", readySelectors: ["form, button"] },
  { name: "Facturas", url: "/app/facturas", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["table"] },
  { name: "Facturas - Recurrentes", url: "/app/facturas/recurrentes", readySelectors: ["table"] },
  { name: "Estado de Cuenta", url: "/app/estado-cuenta", readySelectors: ["table, form"] },
  { name: "Reportes", url: "/app/reportes", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["button"] },
  { name: "Settings", url: "/app/settings", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["form, button"] },
  { name: "Site Builder", url: "/app/site-builder", tabSelectors: ["[role='tab']", "button[role='tab']"], readySelectors: ["[role='toolbar'], button"] },
  { name: "Website", url: "/app/website", readySelectors: ["button, [role='tab']"] },
  { name: "Backoffice", url: "/app/backoffice", readySelectors: ["table, button"] },
  { name: "Comsit", url: "/app/comsit", readySelectors: ["form, button"] },
];

// ============================================================================
// Types
// ============================================================================

interface PageResult {
  name: string;
  url: string;
  success: boolean;
  error?: string;
  loadTime: number;
  consoleErrors: string[];
  networkErrors: { url: string; status: number; statusText: string }[];
  pageErrors: string[];
  tabs: TabResult[];
  warnings: string[];
}

interface TabResult {
  name: string;
  success: boolean;
  error?: string;
  consoleErrors: string[];
  networkErrors: { url: string; status: number; statusText: string }[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for page to be ready with multiple fallback selectors
 */
async function waitForPageReady(page: Page, selectors?: string[]): Promise<boolean> {
  const defaultSelectors = ["nav", "aside", "main", "[role='main']", "body"];
  const toTry = [...(selectors || []), ...defaultSelectors];

  for (const selector of toTry) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Discover tabs on the current page
 */
async function discoverTabs(page: Page): Promise<string[]> {
  const tabs: string[] = new Set();

  // Strategy 1: role="tab"
  const roleTabs = await page.locator("[role='tab']").allTextContents();
  roleTabs.forEach(t => t && tabs.add(t.trim()));

  // Strategy 2: Buttons that look like tabs
  const buttons = await page.locator("button").allTextContents();
  buttons.forEach(b => {
    if (b && b.trim().length > 0 && b.trim().length < 30) {
      tabs.add(b.trim());
    }
  });

  // Strategy 3: Links/tabs with common tab-like text
  const linkTexts = ["Platos", "Vinos", "Bebidas", "Cafes", "Postres", "Turnos", 
                     "Config", "Lista", "Create", "Nuevo", "Settings", "General",
                     "Email", "SMS", "Horarios", "Preview", "Roles", "Miembros"];

  for (const text of linkTexts) {
    const locator = page.locator(`a:has-text("${text}"), button:has-text("${text}"), [role='tab']:has-text("${text}")`);
    if ((await locator.count()) > 0) {
      tabs.add(text);
    }
  }

  return Array.from(tabs).slice(0, 20); // Limit to 20 tabs max
}

/**
 * Visit a page and capture all console activity
 */
async function visitPage(page: Page, config: PageConfig): Promise<PageResult> {
  const result: PageResult = {
    name: config.name,
    url: config.url,
    success: false,
    loadTime: 0,
    consoleErrors: [],
    networkErrors: [],
    pageErrors: [],
    tabs: [],
    warnings: [],
  };

  const consoleCapture = captureConsole(page);
  const startTime = Date.now();

  try {
    await page.goto(config.url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.waitForLoadState("domcontentloaded");

    // Check for login redirect
    if (page.url().includes("/login")) {
      result.error = "Session expired - redirected to login";
      return result;
    }

    // Wait for page to be ready
    await waitForPageReady(page, config.readySelectors);
    
    // Give time for delayed API calls
    await page.waitForTimeout(2000);

    result.loadTime = Date.now() - startTime;

    // Analyze console
    const analysis = assertNoCriticalErrors(consoleCapture);
    result.consoleErrors = analysis.criticalErrors;
    result.networkErrors = analysis.networkErrors;
    result.pageErrors = analysis.criticalPageErrors.map(e => e.message);
    result.warnings = analysis.criticalPageErrors.map(e => e.message);

    result.success = true;

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    result.loadTime = Date.now() - startTime;
    
    const analysis = assertNoCriticalErrors(consoleCapture);
    result.consoleErrors = analysis.criticalErrors;
    result.networkErrors = analysis.networkErrors;
  }

  return result;
}

/**
 * Click a tab and capture console activity
 */
async function clickTab(page: Page, tabName: string, pageName: string): Promise<TabResult> {
  const result: TabResult = {
    name: tabName,
    success: false,
    consoleErrors: [],
    networkErrors: [],
  };

  const consoleCapture = captureConsole(page);

  try {
    // Try multiple selector strategies
    const selectors = [
      `[role='tab']:has-text("${tabName}")`,
      `button:has-text("${tabName}")`,
      `a:has-text("${tabName}")`,
      `[data-tab="${tabName}"]`,
      `[data-ui='tab']:has-text("${tabName}")`,
      `tab:has-text("${tabName}")`,
    ];

    let clicked = false;
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        await locator.click();
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(1500);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      result.error = `Tab "${tabName}" selector not found`;
    } else {
      result.success = true;
    }

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }

  const analysis = assertNoCriticalErrors(consoleCapture);
  result.consoleErrors = analysis.criticalErrors;
  result.networkErrors = analysis.networkErrors;

  return result;
}

/**
 * Generate HTML report
 */
function generateHTMLReport(results: PageResult[]): string {
  const timestamp = new Date().toISOString();
  const totalPages = results.length;
  const successfulPages = results.filter(r => r.success).length;
  const failedPages = results.filter(r => !r.success).length;
  const pagesWithErrors = results.filter(r => 
    r.consoleErrors.length > 0 || r.networkErrors.length > 0 || r.pageErrors.length > 0
  ).length;
  const totalTabs = results.reduce((sum, r) => sum + r.tabs.length, 0);
  const tabsWithErrors = results.reduce((sum, r) => 
    sum + r.tabs.filter(t => t.consoleErrors.length > 0 || t.networkErrors.length > 0).length, 0
  );

  const rows = results.map(r => {
    const tabRows = r.tabs.map(t => `
      <tr class="tab-row">
        <td></td>
        <td class="tab-name">↳ ${escapeHtml(t.name)}</td>
        <td class="${t.success ? 'success' : 'error'}">${t.success ? '✓' : '✗'}</td>
        <td>${t.consoleErrors.length}</td>
        <td>${t.networkErrors.length}</td>
        <td class="error-cell">${escapeHtml(t.error || '')}</td>
      </tr>
    `).join('');

    return `
      <tr class="${r.success ? 'success-row' : 'error-row'}">
        <td>${escapeHtml(r.name)}</td>
        <td><code>${escapeHtml(r.url)}</code></td>
        <td class="${r.success ? 'success' : 'error'}">${r.success ? '✓' : '✗'}</td>
        <td>${r.loadTime}ms</td>
        <td class="${r.consoleErrors.length > 0 ? 'warning' : ''}">${r.consoleErrors.length}</td>
        <td class="${r.networkErrors.length > 0 ? 'warning' : ''}">${r.networkErrors.length}</td>
        <td class="${r.pageErrors.length > 0 ? 'error' : ''}">${r.pageErrors.length}</td>
        <td class="error-cell">${escapeHtml(r.error || '')}</td>
      </tr>
      ${tabRows}
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Full Navigation E2E Report - ${timestamp}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }
    h1 { color: #00d4ff; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat { background: #16213e; padding: 20px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #00d4ff; }
    .stat-label { color: #888; margin-top: 5px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #16213e; padding: 12px; text-align: left; position: sticky; top: 0; }
    td { padding: 10px; border-bottom: 1px solid #333; }
    code { background: #333; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    .success { color: #00ff88; }
    .error { color: #ff6b6b; }
    .warning { color: #ffd93d; }
    .error-row { background: rgba(255, 107, 107, 0.1); }
    .success-row { background: rgba(0, 255, 136, 0.05); }
    .tab-row { background: #0f0f1a; }
    .tab-name { color: #aaa; font-size: 0.9em; }
    .error-cell { color: #ff6b6b; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
    .timestamp { color: #666; font-size: 0.8em; }
  </style>
</head>
<body>
  <h1>📋 Full Navigation E2E Test Report</h1>
  <p class="timestamp">Generated: ${timestamp}</p>
  
  <div class="summary">
    <div class="stat">
      <div class="stat-value">${totalPages}</div>
      <div class="stat-label">Total Pages</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #00ff88">${successfulPages}</div>
      <div class="stat-label">Successful</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #ff6b6b">${failedPages}</div>
      <div class="stat-label">Failed</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #ffd93d">${pagesWithErrors}</div>
      <div class="stat-label">With Errors</div>
    </div>
    <div class="stat">
      <div class="stat-value">${totalTabs}</div>
      <div class="stat-label">Tabs Tested</div>
    </div>
    <div class="stat">
      <div class="stat-value" style="color: #ffd93d">${tabsWithErrors}</div>
      <div class="stat-label">Tab Errors</div>
    </div>
  </div>

  <h2>📄 Page Results</h2>
  <table>
    <thead>
      <tr>
        <th>Page Name</th>
        <th>URL</th>
        <th>Status</th>
        <th>Load Time</th>
        <th>Console Errors</th>
        <th>Network Errors</th>
        <th>Page Errors</th>
        <th>Error Details</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Main Test Suite
// ============================================================================

test.describe("Full Navigation E2E Test (Enhanced)", () => {
  test.setTimeout(900_000); // 15 minutes for comprehensive testing

  let allResults: PageResult[] = [];

  test("navigate through ALL pages, discover and click tabs, check for errors", async ({ adminPage }) => {
    // Verify authentication
    await adminPage.goto("/app");
    await adminPage.waitForLoadState("networkidle");

    if (adminPage.url().includes("/login")) {
      test.skip(true, "Session expired - run: bunx playwright test e2e/global-setup.ts");
      return;
    }

    console.log("\n" + "═".repeat(80));
    console.log("🚀 FULL NAVIGATION E2E TEST - ENHANCED VERSION");
    console.log("═".repeat(80));
    console.log(`📊 Testing ${MAIN_PAGES.length} main pages with dynamic tab discovery\n`);

    for (let i = 0; i < MAIN_PAGES.length; i++) {
      const config = MAIN_PAGES[i];
      
      if (config.skip) {
        console.log(`[${i + 1}/${MAIN_PAGES.length}] ⏭️  Skipping: ${config.name}`);
        continue;
      }

      console.log(`\n[${i + 1}/${MAIN_PAGES.length}] Testing: ${config.name}`);
      console.log(`   URL: ${config.url}`);

      // Visit the page
      const pageResult = await visitPage(adminPage, config);
      allResults.push(pageResult);

      if (!pageResult.success) {
        console.log(`   ❌ FAILED: ${pageResult.error}`);
        continue;
      }

      console.log(`   ✅ Loaded in ${pageResult.loadTime}ms`);

      // Discover and click tabs
      const tabs = await discoverTabs(adminPage);
      console.log(`   🔘 Found ${tabs.length} potential tabs`);

      for (const tabName of tabs) {
        const tabResult = await clickTab(adminPage, tabName, config.name);
        pageResult.tabs.push(tabResult);

        if (tabResult.success) {
          if (tabResult.consoleErrors.length > 0 || tabResult.networkErrors.length > 0) {
            console.log(`      ⚠️  ${tabName}: OK but with errors`);
          } else {
            console.log(`      ✅ ${tabName}`);
          }
        } else {
          console.log(`      ❌ ${tabName}: ${tabResult.error}`);
        }
      }
    }

    // Generate and save report
    const reportDir = path.join(process.cwd(), "test-results");
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const jsonReport = JSON.stringify(allResults, null, 2);
    fs.writeFileSync(path.join(reportDir, "full-navigation-results.json"), jsonReport);

    const htmlReport = generateHTMLReport(allResults);
    fs.writeFileSync(path.join(reportDir, "full-navigation-report.html"), htmlReport);

    console.log("\n" + "═".repeat(80));
    console.log("📊 FINAL RESULTS");
    console.log("═".repeat(80));

    // Calculate totals
    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    const totalTabs = allResults.reduce((sum, r) => sum + r.tabs.length, 0);
    const totalConsoleErrors = allResults.reduce((sum, r) => sum + r.consoleErrors.length, 0);
    const totalNetworkErrors = allResults.reduce((sum, r) => sum + r.networkErrors.length, 0);
    const totalTabErrors = allResults.reduce((sum, r) => 
      sum + r.tabs.filter(t => t.consoleErrors.length > 0 || t.networkErrors.length > 0).length, 0
    );

    console.log(`
📈 Summary:
   Total Pages: ${allResults.length}
   ✅ Successful: ${successful}
   ❌ Failed: ${failed}
   🔘 Tabs Tested: ${totalTabs}
   ⚠️  Console Errors: ${totalConsoleErrors}
   🌐 Network Errors: ${totalNetworkErrors}
   🔘 Tabs with Errors: ${totalTabErrors}

📄 Reports saved to:
   - test-results/full-navigation-results.json
   - test-results/full-navigation-report.html
`);

    // Failed pages
    const failedPages = allResults.filter(r => !r.success);
    if (failedPages.length > 0) {
      console.log("❌ FAILED PAGES:\n");
      for (const r of failedPages) {
        console.log(`   • ${r.name}: ${r.error}`);
      }
      console.log();
    }

    // Pages with errors
    const pagesWithErrors = allResults.filter(r => 
      r.consoleErrors.length > 0 || r.networkErrors.length > 0
    );
    if (pagesWithErrors.length > 0) {
      console.log("⚠️  PAGES WITH ERRORS:\n");
      for (const r of pagesWithErrors) {
        console.log(`   • ${r.name}`);
        r.consoleErrors.forEach(e => console.log(`     └ Console: ${e}`));
        r.networkErrors.forEach(e => console.log(`     └ Network: ${e.status} ${e.url}`));
      }
      console.log();
    }

    console.log("═".repeat(80));

    // Assertions
    expect(failed, "Some pages failed to load").toBe(0);
    
    // We don't fail on console warnings (they're often acceptable)
    // But we do fail if pages don't load
  });

  test("verify no critical page errors across all navigation", async ({ adminPage }) => {
    // Get all page errors from results
    const criticalPageErrors = allResults
      .flatMap(r => r.pageErrors)
      .filter(e => !e.includes("ResizeObserver") && !e.includes("favicon"));

    // Also capture any current page errors
    const currentPageErrors: string[] = [];
    adminPage.on("pageerror", (err) => currentPageErrors.push(err.message));

    // Navigate to a random page
    await adminPage.goto("/app/dashboard");
    await adminPage.waitForLoadState("networkidle");

    const totalErrors = [...criticalPageErrors, ...currentPageErrors];
    expect(totalErrors.length, "No critical page errors should occur").toBe(0);
  });

  test("verify session is still valid after all navigation", async ({ adminPage }) => {
    const sessionData = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      return res.json();
    });

    expect(sessionData.success).toBe(true);
    expect(sessionData.session?.user?.role).toBe("root");
  });
});

// ============================================================================
// Debug/Test Mode
// ============================================================================

/**
 * For debugging a single page, run:
 * bunx playwright test e2e/specs/full-navigation-enhanced.spec.ts --grep="Dashboard"
 */
test.describe("Debug - Single Page", () => {
  test("test a single page for debugging", async ({ adminPage }) => {
    await adminPage.goto("/app/reservas");
    await adminPage.waitForLoadState("networkidle");
    
    // Add your debug code here
    const title = await adminPage.title();
    console.log("Page title:", title);
    
    expect(true).toBe(true);
  });
});
