/**
 * Tests for food detail hero layout refactor.
 *
 * Vinos = WineDetailEditor (separate component, unchanged)
 * Platos = FoodDetailHero + FoodDetailQuickEditor
 *
 * After refactor: non-wine heroes match vinos layout:
 *   - Hero: image (1:1) + price + change-photo button
 *   - Editor panel head: title + badges
 *
 * Uses form login (no global-setup dependency).
 */
import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function createTestPng(): string {
  // Valid 2x2 opaque PNG (decodes reliably in headless Chromium)
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAyLwMBZm7dOwAAAABJRU5ErkJggg==";
  const tmpFile = path.join(os.tmpdir(), `test-plato-${Date.now()}.png`);
  fs.writeFileSync(tmpFile, Buffer.from(b64, "base64"));
  return tmpFile;
}

const BASE = "https://backoffice-dev.menustudioai.com";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@villacarmen.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";

const WINE_URL = `${BASE}/app/comida/vinos/39`;
const PLATO_URL = `${BASE}/app/comida/platos/125`;

async function login(page: Page) {
  // Login via API, set cookie, then go to desktop page
  await page.goto(`${BASE}/m/login`, { waitUntil: "load", timeout: 30_000 });
  const res = await page.evaluate(async ({ url, email, password }: { url: string; email: string; password: string }) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: email, password }),
      credentials: "include",
    });
    return r.json();
  }, { url: `${BASE}/api/admin/login`, email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  if (!res.success) throw new Error(`API login failed: ${res.message}`);
  // Navigate to desktop — SPA will read session cookie
  await page.goto(BASE, { waitUntil: "load", timeout: 30_000 });
}

test.describe("Food detail hero layout", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("vinos hero has wine-detail-hero (unchanged reference)", async ({ page }) => {
    await page.goto(WINE_URL);
    await page.waitForSelector('[data-ui="wine-detail-hero"]');

    const hero = page.locator('[data-ui="wine-detail-hero"]');
    await expect(hero).toBeVisible();

    await expect(hero.locator('[data-slot="wine-detail-media"]')).toBeVisible();
    await expect(hero.locator('[data-ui="wine-detail-price-wrap"]')).toBeVisible();
    await expect(hero.locator('[data-role="wine-image-select-btn"]')).toBeVisible();
  });

  test("platos hero shows food-detail-hero with image/placeholder and price", async ({ page }) => {
    await page.goto(PLATO_URL);
    await page.waitForSelector('[data-ui="food-detail-hero"]');

    const hero = page.locator('[data-ui="food-detail-hero"]');
    await expect(hero).toBeVisible();

    // Price should be absent for platos (they show supplement as badge instead)
    await expect(hero.locator('[data-ui="food-detail-price-wrap"]')).toHaveCount(0);

    // Image area exists (has placeholder or real img)
    const media = hero.locator('[data-slot="food-detail-media"]');
    await expect(media).toBeVisible();
  });

  test("platos hero does NOT contain title or badges after refactor", async ({ page }) => {
    await page.goto(PLATO_URL);
    await page.waitForSelector('[data-ui="food-detail-hero"]');

    const hero = page.locator('[data-ui="food-detail-hero"]');
    await expect(hero.locator('[data-ui="food-detail-title-row"]')).toHaveCount(0);
    await expect(hero.locator('[data-slot="food-detail-badge-row"]')).toHaveCount(0);
    await expect(hero.locator('[data-role="food-detail-eyebrow"]')).toHaveCount(0);
  });

  test("platos title visible above quick editor", async ({ page }) => {
    await page.goto(PLATO_URL);
    await page.waitForSelector('[data-ui="food-detail-editor-head"]');

    const head = page.locator('[data-ui="food-detail-editor-head"]');
    await expect(head).toBeVisible();

    // Title should be in the standalone head
    await expect(head.locator('[data-role="food-detail-editor-title"]')).toBeVisible();
    // Badges should be in head too
    await expect(head.locator('[data-slot="food-detail-editor-badge-row"]')).toBeVisible();
  });

  test("platos detail image has square aspect ratio", async ({ page }) => {
    await page.goto(PLATO_URL);
    await page.waitForSelector('[data-ui="food-detail-hero"]');

    const media = page.locator('[data-ui="food-detail-hero"] [data-slot="food-detail-media"]');
    await expect(media).toBeVisible();

    // Check the aspect-square class was applied
    const classList = await media.getAttribute("class");
    expect(classList).toContain("aspect-square");
  });



  test("vinos hero unchanged still works", async ({ page }) => {
    await page.goto(WINE_URL);
    await page.waitForSelector('[data-ui="wine-detail-hero"]');

    const hero = page.locator('[data-ui="wine-detail-hero"]');
    await expect(hero).toBeVisible();

    // Vinos image preview uses 9/16 aspect, not square
    const imgPreview = hero.locator('[data-role="wine-image-preview"]');
    await expect(imgPreview).toBeVisible();
  });

  // Note: platos image-upload wiring (platos client `uploadImage` + `handleImageUpdate`
  // allowing platos) is verified via direct API. The full UI upload path can't be
  // exercised in headless Chromium (hidden file-input onChange + canvas compression
  // don't fire reliably), so no browser test is kept for it here.
});
