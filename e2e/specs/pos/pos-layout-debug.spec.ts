import { test, expect, type Page } from "@playwright/test";

const BACKOFFICE_URL = process.env.BACKOFFICE_URL || "https://localhost:3010";

const BOOTSTRAP = {
  success: true,
  settings: { isEnabled: true, stockMode: "OFF", coversMode: "MANUAL", timezone: "Europe/Madrid", businessDayCutoff: "05:00" },
  areas: [{ id: 1, name: "Salón" }, { id: 2, name: "Terraza" }],
  tables: [{ id: 7, name: "Mesa 1", capacity: 4, areaId: 1, occupied: false }, { id: 8, name: "Mesa 2", capacity: 4, areaId: 2, occupied: false }],
  visits: [],
  products: Array.from({ length: 48 }, (_, i) => ({
    id: i + 1,
    name: `Producto ${i + 1} ${["Arroces", "Bebidas", "Postres", "Vinos", "Entrantes", "Carnes", "Pescados", "Cafés"][i % 8]}`,
    priceGrossCents: 250 + i * 17,
    vatRate: 10,
    categoryName: ["Arroces", "Bebidas", "Postres", "Vinos", "Entrantes", "Carnes", "Pescados", "Cafés"][i % 8],
    isActive: true,
  })),
};

async function login(page: Page) {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || process.env.E2E_ADMIN_PASSWORD || "";
  await page.goto(`${BACKOFFICE_URL}/login`, { waitUntil: "load" });
  await page.evaluate(async ({ url, email, password }) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
      credentials: "include",
    });
    return res.json();
  }, { url: `${BACKOFFICE_URL}/api/admin/login`, email, password });
}

async function mockPosRoutes(page: Page) {
  await page.route("**/api/admin/pos/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.endsWith("/bootstrap")) return route.fulfill({ json: BOOTSTRAP });
    if (url.endsWith("/visits") && method === "POST") return route.fulfill({ status: 201, json: { success: true, visit: { id: 10, covers: 2, tableId: 7 }, ticket: { id: 11, ticketNumber: "TPV-1", version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } } });
    if (url.endsWith("/tickets/11/lines") && method === "POST") return route.fulfill({ status: 201, json: { success: true, ticket: { id: 11, ticketNumber: "TPV-1", version: 2, status: "OPEN", lines: [{ id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" }], totalGrossCents: 250 } } });
    if (url.includes("/visits/")) return route.fulfill({ json: { success: true, visit: { id: 10, channel: "DINE_IN", tableId: 7, tableName: "Mesa 1", covers: 2, status: "OPEN" }, tickets: [] } });
    return route.fulfill({ json: { success: true, items: [], products: [] } });
  });
  await page.route("**/api/admin/stock/**", (route) => route.fulfill({ json: { success: true, items: [], warehouses: [], recipes: [] } }));
}

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };
function r(rect: DOMRect | undefined): Box | null {
  if (!rect) return null;
  return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const q = (sel: string) => document.querySelector(sel)?.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const docW = document.documentElement.scrollWidth;
    const docH = document.documentElement.scrollHeight;
    const sell = q('[data-testid="pos-sell-screen"]');
    const body = q('[data-testid="pos-sell-body"]');
    const rail = q('[data-testid="pos-control-rail"]');
    const work = q('[data-testid="pos-sell-work"]');
    const register = q('[data-testid="pos-sell-row-register"]');
    const catalog = q('[data-testid="pos-sell-row-catalog"]');
    const keypad = q('[data-testid="pos-keypad"]');
    const ticket = q('[data-testid="pos-ticket-panel"]');
    const keypadGrid = q('.pos-keypad__grid');
    const products = q('[data-testid="pos-product-grid"]');
    const categories = q('[data-testid="pos-category-panel"]');
    const posPage = q('[data-ui="pos-page"]');
    const main = q('[data-testid="app-layout-main"]');

    const boxes = { sell, body, rail, work, register, catalog, keypad, ticket, keypadGrid, products, categories, posPage, main };
    const out: Record<string, any> = {
      viewport: { vw, vh },
      document: { scrollW: docW, scrollH: docH, hOverflow: docW - vw, vOverflow: docH - vh },
      boxes: Object.fromEntries(Object.entries(boxes).map(([k, v]) => [k, v ? { top: v.top, bottom: v.bottom, left: v.left, right: v.right, width: v.width, height: v.height } : null])),
    };
    // Overlap between register and catalog rows
    if (register && catalog) {
      out.registerVsCatalogVerticalOverlap = Math.max(0, Math.min(register.bottom, catalog.bottom) - Math.max(register.top, catalog.top));
      out.registerVsCatalogHOverlap = Math.max(0, Math.min(register.right, catalog.right) - Math.max(register.left, catalog.left));
    }
    // Rail vs work vertical alignment
    if (rail && work) {
      out.railWorkBottomDelta = Math.abs(rail.bottom - work.bottom);
    }
    // Keypad inside its row?
    if (keypad && register) {
      out.keypadExceedsRow = keypad.bottom - register.bottom;
      out.keypadExceedsRowTop = register.top - keypad.top;
    }
    // Keypad grid inside keypad?
    if (keypadGrid && keypad) {
      out.keypadGridExceeds = keypadGrid.bottom - keypad.bottom;
      out.keypadGridHeightDelta = keypad.height - keypadGrid.height;
    }
    // Elements overflowing viewport horizontally
    const hOverflowEls: string[] = [];
    for (const [k, b] of Object.entries(boxes)) {
      if (b && (b.right > vw + 0.5 || b.left < -0.5)) hOverflowEls.push(`${k}(${b.left},${b.right})`);
    }
    out.horizontalOverflowEls = hOverflowEls;
    // Sell screen taller than viewport / main
    if (sell) out.sellVsViewport = sell.height - vh;
    if (posPage) out.posPageHeight = posPage.height;
    return out;
  });
}

function fmt(prefix: string, m: any) {
  const one = (k: string) => m[k];
  console.log(prefix, JSON.stringify({
    vw: m.viewport.vw, vh: m.viewport.vh,
    hOverflow: m.document.hOverflow, vOverflow: m.document.vOverflow,
    registerVsCatalog: m.registerVsCatalogVerticalOverlap,
    keypadExceedsRow: m.keypadExceedsRow,
    keypadGridExceeds: m.keypadGridExceeds,
    sellVsViewport: m.sellVsViewport,
    railWorkBottomDelta: m.railWorkBottomDelta,
    hOverflowEls: m.horizontalOverflowEls,
    sellBottom: m.boxes.sell?.bottom,
  }));
}

const BREAKPOINTS = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "desktop-1280x800", width: 1280, height: 800 },
  { name: "laptop-1366x768", width: 1366, height: 768 },
  { name: "desktop-1024x768", width: 1024, height: 768 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "phone-landscape-667x375", width: 667, height: 375 },
  { name: "phone-large-428x926", width: 428, height: 926 },
  { name: "phone-375x812", width: 375, height: 812 },
  { name: "phone-small-320x568", width: 320, height: 568 },
];

test.describe("POS layout debug", () => {
  test("measure integrated layout across viewports", async ({ browser }) => {
    for (const bp of BREAKPOINTS) {
      const context = await browser.newContext({ viewport: { width: bp.width, height: bp.height }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await login(page);
      await mockPosRoutes(page);
      await page.goto(`${BACKOFFICE_URL}/app/pos`);
      await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(300);
      const m = await measure(page);
      fmt(`[${bp.name}]`, m);
      await page.screenshot({ path: `test-results/artifacts/pos-${bp.name}.png`, fullPage: false });
      await context.close();
    }
  });

  test("measure fullscreen layout across viewports", async ({ browser }) => {
    for (const bp of BREAKPOINTS.slice(0, 7)) {
      const context = await browser.newContext({ viewport: { width: bp.width, height: bp.height }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await login(page);
      await mockPosRoutes(page);
      await page.goto(`${BACKOFFICE_URL}/app/pos`);
      await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("pos-section-menu").click();
      await page.getByTestId("pos-view-fullscreen").click();
      await page.waitForTimeout(300);
      const m = await measure(page);
      // extra: fullscreen main width
      const fsInfo = await page.evaluate(() => {
        const main = document.querySelector('[data-testid="app-layout-main"]');
        const r = main?.getBoundingClientRect();
        const sidebar = document.querySelector('[data-testid="sidebar-nav-desktop"]');
        const topbar = document.querySelector('[data-testid="topbar"]');
        const posPage = document.querySelector('[data-ui="pos-page"]')?.getBoundingClientRect();
        return {
          main: r ? { left: r.left, width: r.width, right: r.right, height: r.height } : null,
          sidebarPresent: !!sidebar,
          topbarPresent: !!topbar,
          posPage: posPage ? { top: posPage.top, bottom: posPage.bottom, height: posPage.height } : null,
        };
      });
      fmt(`[${bp.name} fullscreen]`, m);
      console.log(`[${bp.name} fullscreen]`, JSON.stringify(fsInfo));
      await page.screenshot({ path: `test-results/artifacts/pos-${bp.name}-fullscreen.png`, fullPage: false });
      await context.close();
    }
  });

  test("has no structural POS overlap in desktop and fullscreen", async ({ browser }) => {
    const cases = [
      { name: "integrated-1280", width: 1280, height: 800, fullscreen: false },
      { name: "integrated-1024", width: 1024, height: 768, fullscreen: false },
      { name: "fullscreen-1280", width: 1280, height: 800, fullscreen: true },
      { name: "fullscreen-1024", width: 1024, height: 768, fullscreen: true },
    ];

    for (const item of cases) {
      const context = await browser.newContext({ viewport: { width: item.width, height: item.height }, ignoreHTTPSErrors: true });
      const page = await context.newPage();
      await login(page);
      await mockPosRoutes(page);
      await page.goto(`${BACKOFFICE_URL}/app/pos`);
      await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible({ timeout: 30_000 });
      if (item.fullscreen) {
        await page.getByTestId("pos-section-menu").click();
        await page.getByTestId("pos-view-fullscreen").click();
      }
      const result = await page.evaluate(() => {
        const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect();
        const register = rect('[data-testid="pos-sell-row-register"]');
        const catalog = rect('[data-testid="pos-sell-row-catalog"]');
        const keypad = rect('[data-testid="pos-keypad"]');
        const rail = rect('[data-testid="pos-control-rail"]');
        const work = rect('[data-testid="pos-sell-work"]');
        const main = rect('[data-testid="app-layout-main"]');
        const pageRect = rect('[data-ui="pos-page"]');
        const verticalOverlap = register && catalog
          ? Math.max(0, Math.min(register.bottom, catalog.bottom) - Math.max(register.top, catalog.top))
          : 0;
        const horizontalOverlap = register && catalog
          ? Math.max(0, Math.min(register.right, catalog.right) - Math.max(register.left, catalog.left))
          : 0;
        return {
          verticalOverlap,
          horizontalOverlap,
          keypadOverRow: keypad && register ? Math.max(0, keypad.bottom - register.bottom) : 0,
          railWorkBottomDelta: rail && work ? Math.abs(rail.bottom - work.bottom) : 0,
          pageWithinMain: pageRect && main ? pageRect.bottom <= main.bottom + 1 : true,
        };
      });
      expect(result.verticalOverlap, item.name).toBe(0);
      // Rows intentionally share the same horizontal span. They must only
      // overlap when both axes intersect.
      expect(result.verticalOverlap > 0 && result.horizontalOverlap > 0, item.name).toBe(false);
      expect(result.keypadOverRow, item.name).toBe(0);
      expect(result.railWorkBottomDelta, item.name).toBeLessThanOrEqual(1);
      await context.close();
    }
  });
});
