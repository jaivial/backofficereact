import { test, expect, type Page } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Bottom navigation hiding while the map is in edit/draw mode.
 *
 * On narrow / portrait viewports the app sidebar becomes a bottom navbar
 * (`@media (max-width: 720px), (max-aspect-ratio: 9 / 16)`). While the map
 * editor is active (`editMode`), that bottom navbar must disappear so the
 * drawing canvas gets the full viewport. On desktop (left sidebar layout) the
 * sidebar must stay visible in edit mode.
 */

const TEST_DATE = "2026-04-05";
const MAP_PAGE = '[data-ui="table-map-page"]';
const SIDEBAR = '[data-ui="sidebar"]';
const MOBILE_NAV = '[data-slot="sidebar-nav-mobile"]';
const EDIT_SWITCH = '[data-ui="edit-mode-toggle"] button';

async function loadMap(page: Page) {
  await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
}

async function isEditMode(page: Page): Promise<boolean> {
  const state = await page.locator(EDIT_SWITCH).first().getAttribute("aria-checked");
  return state === "true";
}

async function setEditMode(page: Page, on: boolean) {
  if ((await isEditMode(page)) === on) return;
  await page.locator(EDIT_SWITCH).first().click();
}

test.describe("Tables Map - bottom nav in edit mode", () => {
  test.describe.configure({ retries: 2 });

  test("shows the bottom nav in read mode on mobile", async ({ adminTouchPage }) => {
    await loadMap(adminTouchPage);

    await expect(adminTouchPage.locator(SIDEBAR)).toBeVisible({ timeout: 15_000 });
    await expect(adminTouchPage.locator(MOBILE_NAV)).toBeVisible();
  });

  test("hides the bottom nav when entering edit mode on mobile", async ({ adminTouchPage }) => {
    await loadMap(adminTouchPage);

    await setEditMode(adminTouchPage, true);

    await expect(adminTouchPage.locator(SIDEBAR)).toBeHidden({ timeout: 15_000 });
    await expect(adminTouchPage.locator(MOBILE_NAV)).toBeHidden();
  });

  test("restores the bottom nav when leaving edit mode on mobile", async ({ adminTouchPage }) => {
    await loadMap(adminTouchPage);

    await setEditMode(adminTouchPage, true);
    await expect(adminTouchPage.locator(SIDEBAR)).toBeHidden({ timeout: 15_000 });

    await setEditMode(adminTouchPage, false);
    await expect(adminTouchPage.locator(SIDEBAR)).toBeVisible({ timeout: 15_000 });
  });

  test("keeps the desktop sidebar visible in edit mode", async ({ adminPage }) => {
    await loadMap(adminPage);

    await setEditMode(adminPage, true);

    await expect(adminPage.locator(SIDEBAR)).toBeVisible({ timeout: 15_000 });
  });
});
