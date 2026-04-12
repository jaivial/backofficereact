/**
 * Playwright Component Testing (CT) for FoodItemCard.
 *
 * Uses Playwright's `mount()` approach via full page navigation with session seeding.
 * Since FoodItemCard renders within the /app/comida/* pages, we test it by navigating
 * to those pages (which mounts the component tree) rather than using Playwright's
 * isolated mount() which doesn't give us Jotai context.
 *
 * This gives us:
 * - Real headed Chromium browser rendering
 * - Full Tailwind CSS + bo.css styling
 * - Jotai atom state (via seeded session)
 * - SSR + hydration as in production
 *
 * For isolated component testing without the full app context,
 * use the vitest tests: pages/app/comida/_components/FoodItemCard.ct.test.tsx
 *
 * Run with:
 *   npx playwright test -c playwright.ct-config.ts src/components/FoodItemCard.ct.tsx
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_CACHE_FILE = "test-results/.ct-session-cache.json";

/**
 * Seed admin session cookie into the test context.
 * Reads from the cache file written by global-setup-ct.ts.
 * Call this before navigating to app pages that need auth.
 */
async function seedSession(page: import("@playwright/test").Page): Promise<void> {
  const fs = await import("fs");

  let session: string | undefined;
  if (fs.existsSync(SESSION_CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(SESSION_CACHE_FILE, "utf-8"));
      if (cached.bo_session && cached.expiresAt && Date.now() < cached.expiresAt) {
        session = cached.bo_session;
      }
    } catch {
      // ignore
    }
  }

  if (session) {
    await page.context().addCookies([
      {
        name: "bo_session",
        value: session,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
  } else {
    throw new Error("[seedSession] No session found in cache. Run global-setup first.");
  }
}

// ---------------------------------------------------------------------------
// Vinos Page — Wine Item Cards
// ---------------------------------------------------------------------------

test.describe("FoodItemCard on /app/comida/vinos", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("page navigates and loads wine list", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");

    // Verify correct page
    expect(page.url()).toContain("/app/comida/vinos");

    // Wait for either food grid or empty state
    await page.waitForSelector(
      "[data-ui='food-list-grid'], [data-ui='food-list-empty'], [data-ui='food-list-loading']",
      { timeout: 10_000 }
    );
  });

  test("wine cards render with correct data attributes", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(
      "[data-ui='food-list-grid'], [data-ui='food-list-empty']",
      { timeout: 10_000 }
    );

    const card = page.locator("[data-ui='dish-card']").first();

    // If there are items, verify card structure
    if (await card.count() > 0) {
      // Title
      const title = card.locator("[data-role='dish-card-title']");
      await expect(title).toBeVisible();

      // Price
      const price = card.locator("[data-role='dish-card-price']");
      await expect(price).toBeVisible();

      // Edit button
      const editBtn = card.locator("[data-role='food-card-edit-btn']");
      await expect(editBtn).toBeAttached();

      // Delete button
      const deleteBtn = card.locator("[data-role='food-card-delete-btn']");
      await expect(deleteBtn).toBeAttached();
    }
  });

  test("wine card shows price formatted in EUR", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    const price = page.locator("[data-role='dish-card-price']").first();
    if (await price.count() > 0) {
      const priceText = await price.textContent();
      // EUR formatting: 18.5 → "18,50 €" or similar
      expect(priceText).toMatch(/^\d+[.,]\d+\s*€/);
    }
  });

  test("inactive wine cards show inactive badge", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    const inactiveBadge = page.locator("[data-role='dish-card-inactive-badge']");
    const hasInactive = await inactiveBadge.count() > 0;

    if (hasInactive) {
      await expect(inactiveBadge.first()).toContainText("Inactivo");
    }
  });

  test("edit button click navigates to detail page", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    const editBtn = page.locator("[data-role='food-card-edit-btn']").first();
    if (await editBtn.count() > 0) {
      await editBtn.click();

      // Should navigate to detail page
      await page.waitForURL(/\/app\/comida\/vinos\/\d+/, { timeout: 5_000 });
      expect(page.url()).toMatch(/\/app\/comida\/vinos\/\d+/);
    }
  });

  test("toggle switch triggers API call on click", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/vinos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    // HeadlessUI Switch renders as a button with class "bo-sc-switch"
    // (no role="switch" attribute)
    const toggle = page.locator("[data-ui='dish-card-actions'] .bo-sc-switch").first();

    if (await toggle.count() === 0) {
      test.skip(); // No toggle found
      return;
    }

    await expect(toggle).toBeVisible();

    // Capture the PATCH request that fires on toggle
    const [apiRequest] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes("/api/admin/vinos") && req.method() === "PATCH",
        { timeout: 5000 }
      ),
      toggle.click(),
    ]);

    expect(apiRequest).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Platos Page — Plato Item Cards
// ---------------------------------------------------------------------------

test.describe("FoodItemCard on /app/comida/platos", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("plato cards render with categoria badge", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/platos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    const card = page.locator("[data-ui='dish-card']").first();
    if (await card.count() > 0) {
      const meta = card.locator("[data-ui='dish-card-meta']");
      await expect(meta).toBeVisible();
    }
  });

  test("plato detail page loads via edit navigation", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/platos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid']", { timeout: 10_000 });

    const editBtn = page.locator("[data-role='food-card-edit-btn']").first();
    if (await editBtn.count() > 0) {
      await editBtn.click();
      await page.waitForURL(/\/app\/comida\/platos\/\d+/, { timeout: 10_000 });
      expect(page.url()).toMatch(/\/app\/comida\/platos\/\d+/);
    }
  });
});

// ---------------------------------------------------------------------------
// FoodList — Grid Layout
// ---------------------------------------------------------------------------

test.describe("FoodList — Grid and Layout", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("FAB create button is visible and in viewport", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/platos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector(
      "[data-ui='food-list-grid'], [data-ui='food-list-empty']",
      { timeout: 10_000 }
    );

    const fab = page.locator("[data-role='food-list-create-btn']");
    await expect(fab).toBeVisible();
    await expect(fab).toBeInViewport();
  });

  test("FAB navigates to /new page (not a modal)", async ({ page }) => {
    await page.goto("https://localhost:3001/app/comida/platos");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("[data-ui='food-list-grid'], [data-ui='food-list-empty']", {
      timeout: 10_000,
    });

    const fab = page.locator("[data-role='food-list-create-btn']");
    await fab.click();

    // Must navigate to a URL with /new (window.location.assign causes full page reload)
    await page.waitForURL(/\/app\/comida\/[a-z]+\/new/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/app\/comida\/[a-z]+\/new/);
  });

  test("empty state shows helper text with FAB reference", async ({ page }) => {
    // Use a food type that might be empty (e.g., cafes)
    await page.goto("https://localhost:3001/app/comida/cafes");
    await page.waitForLoadState("networkidle");

    // Wait for either grid or empty state
    const hasGrid = await page.locator("[data-ui='food-list-grid']").count() > 0;
    if (!hasGrid) {
      const emptyText = page.locator("[data-role='food-list-empty-text']");
      const emptyHint = page.locator("[data-role='food-list-empty-hint']");
      await expect(emptyText).toBeVisible();
      await expect(emptyHint).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Responsive Layout Tests
// ---------------------------------------------------------------------------

test.describe("FoodItemCard — Responsive Layout", () => {
  const viewports = [
    { name: "desktop-xl", width: 1920, height: 1080 },
    { name: "desktop-lg", width: 1440, height: 900 },
    { name: "desktop-md", width: 1280, height: 800 },
    { name: "desktop-sm", width: 1024, height: 768 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile-lg", width: 428, height: 926 },
    { name: "mobile-md", width: 375, height: 812 },
    { name: "mobile-sm", width: 320, height: 568 },
  ] as const;

  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}x${vp.height}): no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedSession(page);

      await page.goto("https://localhost:3001/app/comida/platos");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(
        "[data-ui='food-list-grid'], [data-ui='food-list-empty']",
        { timeout: 10_000 }
      );

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });

    test(`${vp.name}: FAB is reachable in viewport`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedSession(page);

      await page.goto("https://localhost:3001/app/comida/platos");
      await page.waitForLoadState("networkidle");
      await page.waitForSelector(
        "[data-ui='food-list-grid'], [data-ui='food-list-empty']",
        { timeout: 10_000 }
      );

      const fab = page.locator("[data-role='food-list-create-btn']");
      if (await fab.count() > 0) {
        await expect(fab).toBeInViewport({ timeout: 3000 });
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Session-seeded Jotai State Tests
// ---------------------------------------------------------------------------

test.describe("Session-seeded components — Jotai state", () => {
  test("session cookie is present after seeding", async ({ page }) => {
    await seedSession(page);

    await page.goto("https://localhost:3001/app/comida/platos");
    await page.waitForLoadState("networkidle");

    const cookies = await page.context().cookies("https://localhost");
    const boSession = cookies.find((c) => c.name === "bo_session");
    expect(boSession).toBeDefined();
    expect(boSession?.value.length).toBeGreaterThan(0);
  });

  test("unauthenticated access redirects to login", async ({ browser }) => {
    // Create a fresh context WITHOUT session cookie
    const freshContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const freshPage = await freshContext.newPage();

    await freshPage.goto("https://localhost:3001/app/comida/platos");
    await freshPage.waitForLoadState("networkidle");

    // Should redirect to login
    await freshPage.waitForURL(/\/login/, { timeout: 10_000 });
    expect(freshPage.url()).toContain("/login");

    await freshContext.close();
  });
});
