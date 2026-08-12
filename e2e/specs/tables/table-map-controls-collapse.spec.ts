import { test, expect, type Page } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Collapsible React Flow controls panel (bottom-left of the map canvas).
 *
 * Expanded state: the panel shows a lucide collapse icon at the top, above
 * the zoom / interactivity / select / pan buttons.
 * Collapsed state: the whole panel is hidden and a single expand icon stays
 * pinned to the bottom-left corner of the flow wrapper.
 */

const TEST_DATE = "2026-04-05";
const MAP_PAGE = '[data-ui="table-map-page"]';
const CONTROLS = ".react-flow__controls";
const COLLAPSE_BTN = '[data-ui="controls-collapse-btn"]';
const EXPAND_BTN = '[data-ui="controls-expand-btn"]';

async function loadMap(page: Page) {
  await page.goto(`/app/reservas/tables?date=${TEST_DATE}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
}

test.describe("Tables Map - controls panel collapse", () => {
  test.describe.configure({ retries: 2 });

  test("renders a collapse button above the interaction controls", async ({ adminPage }) => {
    await loadMap(adminPage);

    const collapse = adminPage.locator(COLLAPSE_BTN);
    await expect(collapse).toBeVisible({ timeout: 15_000 });

    // The collapse button sits on top of the custom interaction controls
    // (select / pan), which is what this panel adds on top of React Flow's
    // built-in zoom / fit-view / interactivity buttons.
    const selectBtn = adminPage.locator('[aria-label="Seleccionar (cursor)"]');
    await expect(selectBtn).toBeVisible();

    const collapseBox = await collapse.boundingBox();
    const selectBox = await selectBtn.boundingBox();
    expect(collapseBox).not.toBeNull();
    expect(selectBox).not.toBeNull();
    expect(collapseBox!.y).toBeLessThan(selectBox!.y);

    // Expand icon is not rendered while the panel is expanded.
    await expect(adminPage.locator(EXPAND_BTN)).toHaveCount(0);
  });

  test("collapsing hides the panel and shows the expand button bottom-left", async ({ adminPage }) => {
    await loadMap(adminPage);

    await adminPage.locator(COLLAPSE_BTN).click();

    await expect(adminPage.locator(CONTROLS)).toHaveCount(0);
    await expect(adminPage.locator(EXPAND_BTN)).toBeVisible({ timeout: 15_000 });
  });

  test("expanding restores the controls panel", async ({ adminPage }) => {
    await loadMap(adminPage);

    await adminPage.locator(COLLAPSE_BTN).click();
    await expect(adminPage.locator(EXPAND_BTN)).toBeVisible();

    await adminPage.locator(EXPAND_BTN).click();

    await expect(adminPage.locator(CONTROLS)).toBeVisible({ timeout: 15_000 });
    await expect(adminPage.locator(COLLAPSE_BTN)).toBeVisible();
    await expect(adminPage.locator(EXPAND_BTN)).toHaveCount(0);
  });
});
