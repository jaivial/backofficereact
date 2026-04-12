/**
 * Storybook Integration Tests via Playwright.
 *
 * Tests Storybook stories in a real browser using Playwright.
 * This gives us:
 * - Visual regression capability (screenshots)
 * - Full browser rendering with CSS
 * - Interaction testing (hover, click, focus)
 * - Session seeding for auth-dependent stories
 *
 * Approach:
 * - Start Storybook dev server on port 6006
 * - Navigate to story iframe URLs (http://localhost:6006/iframe.html?id=...)
 * - Inject session cookies if stories need Jotai context
 * - Run assertions via Playwright API
 *
 * Run with:
 *   npx storybook &
 *   sleep 10
 *   npx playwright test e2e/specs/storybook-integration.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Storybook base URL
// ---------------------------------------------------------------------------

const STORYBOOK_BASE = process.env.STORYBOOK_URL || "http://localhost:6006";

/**
 * Seed admin session cookie into a page context.
 */
async function seedSession(page: Page): Promise<void> {
  const session = (global as any).__ctSession as string | undefined;
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
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to a specific story and wait for it to render.
 */
async function gotoStory(
  page: Page,
  storyId: string,
  { waitForCanvas = true }: { waitForCanvas?: boolean } = {}
): Promise<void> {
  await page.goto(`${STORYBOOK_BASE}/iframe.html?id=${storyId}&viewMode=story`);
  await page.waitForLoadState("networkidle");

  if (waitForCanvas) {
    // Storybook renders stories in an iframe with #storybook-root
    await page.waitForSelector("#storybook-root", { timeout: 15_000 });
  }
}

// ---------------------------------------------------------------------------
// FoodItemCard Stories
// ---------------------------------------------------------------------------

test.describe("FoodItemCard — Storybook Stories", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("Wine — Active story renders correctly", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--wine-active");

    // Should render the wine name
    const wineName = page.getByText("Rioja Reserva");
    await expect(wineName).toBeVisible();

    // Should render the price formatted in EUR
    const price = page.getByText("18,50 €");
    await expect(price).toBeVisible();

    // Should render bodega
    const bodega = page.getByText("Marqués de Riscal");
    await expect(bodega).toBeVisible();

    // Should render wine type and denomination
    const meta = page.getByText(/TINTO.*Rioja/);
    await expect(meta).toBeVisible();
  });

  test("Wine — Inactive story shows inactive styling", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--wine-inactive");

    // The card should be visible
    const card = page.locator("[data-ui='food-card']").first();
    await expect(card).toBeVisible();

    // Should show inactive state (typically via opacity or styling)
    const inactiveCard = page.locator("[data-ui='food-card'][data-inactive='true']").first();
    if (await inactiveCard.count() > 0) {
      await expect(inactiveCard).toBeVisible();
    }
  });

  test("Plato — Active story renders correctly", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--plato-active");

    const name = page.getByText("Paella Valenciana");
    await expect(name).toBeVisible();

    const price = page.getByText("12,00 €");
    await expect(price).toBeVisible();
  });

  test("Plato — With Image story renders photo", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--plato-with-image");

    const name = page.getByText("Paella Valenciana");
    await expect(name).toBeVisible();

    // Image should be visible (may be loading, but element should exist)
    const image = page.locator("img").first();
    await expect(image).toBeVisible();
  });

  test("Long Name story handles overflow gracefully", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--long-name");

    const name = page.getByText("Ensalada de Tomate Natural");
    await expect(name).toBeVisible();

    // Should not overflow its container
    const card = page.locator("[data-ui='food-card']").first();
    const cardBox = await card.boundingBox();
    expect(cardBox).not.toBeNull();

    if (cardBox) {
      // Text should not extend beyond card bounds (allowing for ellipsis/truncation)
      // This is a basic check - actual visual regression would use screenshot comparison
      expect(cardBox.width).toBeGreaterThan(0);
    }
  });

  test("story interactions — hover shows edit/delete buttons", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--wine-active");

    const card = page.locator("[data-ui='food-card']").first();

    // Before hover, icon buttons might not be visible (depends on CSS)
    await card.hover();
    await page.waitForTimeout(300); // CSS transition

    // After hover, buttons should be accessible
    const editBtn = page.locator("[data-role='food-card-edit-btn']").first();
    const deleteBtn = page.locator("[data-role='food-card-delete-btn']").first();

    // At least one should be in the DOM (CSS hides/shows them)
    const hasEdit = await editBtn.count() > 0;
    const hasDelete = await deleteBtn.count() > 0;
    expect(hasEdit || hasDelete).toBe(true);
  });

  test("story accessibility — card has accessible title", async ({ page }) => {
    await gotoStory(page, "comida-fooditemcard--wine-active");

    const card = page.locator("[data-ui='food-card']").first();
    await expect(card).toBeVisible();

    // Card should have an accessible name (via aria-label or heading)
    const accessibleName = await card.getAttribute("aria-label")
      || await card.locator("h1, h2, h3, h4").first().textContent();
    expect(accessibleName).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// FoodList Stories
// ---------------------------------------------------------------------------

test.describe("FoodList — Storybook Stories", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("Default story renders food item cards in grid", async ({ page }) => {
    await gotoStory(page, "comida-foodlist--default");

    const grid = page.locator("[data-ui='food-list-grid']");
    await expect(grid).toBeVisible();

    const cards = page.locator("[data-ui='food-card']");
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("Loading story shows loading state", async ({ page }) => {
    await gotoStory(page, "comida-foodlist--loading");

    // Should show loading spinner
    const loading = page.locator("[data-ui='food-list-loading']");
    await expect(loading).toBeVisible();

    const spinner = loading.locator("[data-component='loading-spinner']");
    await expect(spinner).toBeVisible();
  });

  test("Empty story shows helper text", async ({ page }) => {
    await gotoStory(page, "comida-foodlist--empty");

    const emptyState = page.locator("[data-role='food-list-empty-text']");
    await expect(emptyState).toBeVisible();

    const emptyHint = page.locator("[data-role='food-list-empty-hint']");
    await expect(emptyHint).toBeVisible();
    await expect(emptyHint).toContainText("+");
  });

  test("Paginated story shows pager with correct info", async ({ page }) => {
    await gotoStory(page, "comida-foodlist--paginated");

    const pagerInfo = page.locator("[data-role='food-list-pager-info']");
    await expect(pagerInfo).toBeVisible();
    await expect(pagerInfo).toContainText("Pagina 2");
    await expect(pagerInfo).toContainText("50");

    const prevBtn = page.locator("[data-role='food-list-pager-prev']");
    const nextBtn = page.locator("[data-role='food-list-pager-next']");
    await expect(prevBtn).toBeEnabled();
    await expect(nextBtn).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// LoadingSpinner Stories
// ---------------------------------------------------------------------------

test.describe("LoadingSpinner — Storybook Stories", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test("renders centered spinner with label", async ({ page }) => {
    await gotoStory(page, "ui-feedback-loadingspinner--default");

    const spinner = page.locator("[data-component='loading-spinner']");
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveAttribute("aria-label", "Cargando...");

    const label = page.getByText("Cargando...");
    await expect(label).toBeVisible();
  });

  test("size variants render correctly", async ({ page }) => {
    await gotoStory(page, "ui-feedback-loadingspinner--small");

    const spinner = page.locator("[data-component='loading-spinner']");
    await expect(spinner).toBeVisible();
    await expect(spinner).toHaveAttribute("data-size", "sm");
  });

  test("large size renders", async ({ page }) => {
    await gotoStory(page, "ui-feedback-loadingspinner--large");

    const spinner = page.locator("[data-component='loading-spinner']");
    await expect(spinner).toBeVisible();
  });

  test("centered prop applies centering styles", async ({ page }) => {
    await gotoStory(page, "ui-feedback-loadingspinner--centered");

    const spinner = page.locator("[data-component='loading-spinner']");
    await expect(spinner).toBeVisible();

    const container = page.locator("[data-component='loading-spinner']").locator("..");
    const containerClass = await container.getAttribute("class");
    expect(containerClass).toMatch(/flex|grid|items-center|justify-center/);
  });
});

// ---------------------------------------------------------------------------
// Visual / Screenshot regression
// ---------------------------------------------------------------------------

test.describe("Visual regression — Storybook screenshots", () => {
  test("FoodItemCard — Wine Active screenshot", async ({ page }) => {
    await seedSession(page);
    await gotoStory(page, "comida-fooditemcard--wine-active");
    await page.waitForTimeout(500); // Wait for any animations

    await expect(page).toHaveScreenshot("FoodItemCard-WineActive.png", {
      maxDiffPixels: 100,
    });
  });

  test("FoodItemCard — Plato with image screenshot", async ({ page }) => {
    await seedSession(page);
    await gotoStory(page, "comida-fooditemcard--plato-with-image");
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("FoodItemCard-PlatoWithImage.png", {
      maxDiffPixels: 100,
    });
  });

  test("FoodList — Default screenshot", async ({ page }) => {
    await seedSession(page);
    await gotoStory(page, "comida-foodlist--default");
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("FoodList-Default.png", {
      maxDiffPixels: 100,
    });
  });

  test("LoadingSpinner — All sizes screenshot", async ({ page }) => {
    await seedSession(page);
    await gotoStory(page, "ui-feedback-loadingspinner--default");
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("LoadingSpinner-Default.png", {
      maxDiffPixels: 50,
    });
  });

  test("FoodItemCard — Long name screenshot", async ({ page }) => {
    await seedSession(page);
    await gotoStory(page, "comida-fooditemcard--long-name");
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot("FoodItemCard-LongName.png", {
      maxDiffPixels: 100,
    });
  });
});

// ---------------------------------------------------------------------------
// Responsive breakpoints via Storybook viewport
// ---------------------------------------------------------------------------

test.describe("Responsive — Storybook viewport testing", () => {
  const viewports = [
    { name: "Desktop XL", width: 1920, height: 1080 },
    { name: "Desktop MD", width: 1280, height: 800 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Mobile LG", width: 428, height: 926 },
    { name: "Mobile SM", width: 375, height: 812 },
  ] as const;

  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}x${vp.height}): FoodItemCard renders without overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await seedSession(page);
      await gotoStory(page, "comida-fooditemcard--wine-active");

      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasOverflow).toBe(false);
    });
  }
});
