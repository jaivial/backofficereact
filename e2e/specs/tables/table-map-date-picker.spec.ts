import { test, expect } from "../../fixtures/session";
import { waitForLoadingToFinish } from "../../helpers/wait";

/**
 * Real-app E2E coverage for the table map header date picker
 * (app/reservas/tables?date).
 *
 * The picker lives inside the header div `.bo-tableMapTopCenter` (and the
 * closed-day top bar) and uses the reusable DatePicker whose popover renders
 * with classes `bo-datePop bo-datePop--glass`.
 *
 * Credentials/URL come from the `# E2E playwright real app` section of .env
 * (URL, LOGIN_USER, LOGIN_PASSWORD) wired by playwright.config.ts.
 */

const PICKER_BTN = '[data-testid="table-map-date-picker"]';
const PICKER_POPOVER = '[data-ui="date-picker-popover"]';
const TOP_CENTER = '[data-ui="top-center"].bo-tableMapTopCenter';
const SHEET_DATE_LABEL = '[data-ui="date-label"]';
const MAP_PAGE = '[data-ui="table-map-page"]';
const FLOW_WRAPPER = '[data-ui="flow-wrapper"]';
const CLOSED_VIEW = '[data-ui="table-map-closed"]';

function dayCell(dateISO: string): string {
  return `[data-ui="date-picker-day"][data-date="${dateISO}"]`;
}

/** Navigate to the table map and wait for the header date picker to be ready. */
async function loadMap(page: import("@playwright/test").Page, query = "") {
  await page.goto(`/app/reservas/tables${query}`);
  await expect(page.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
  await waitForLoadingToFinish(page);
  await expect(page.locator(PICKER_BTN)).toBeVisible({ timeout: 20_000 });
}

async function openDatePicker(page: import("@playwright/test").Page) {
  await expect(page.locator(PICKER_BTN)).toBeVisible({ timeout: 20_000 });
  await page.locator(PICKER_BTN).click();
  await expect(page.locator(PICKER_POPOVER)).toBeVisible({ timeout: 5_000 });
}

async function todayISOInBrowser(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
}

test.describe("Tables Map - Header Date Picker", () => {
  // The dev tunnel can stall page loads under parallel load; retry once per
  // test so genuine failures are not masked by a slow dev server.
  test.describe.configure({ mode: "serial", retries: 2 });

  test("header renders the reusable date picker with the selected date inside top-center", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    const topCenter = adminPage.locator(TOP_CENTER);
    await expect(topCenter).toBeVisible({ timeout: 15_000 });

    const picker = topCenter.locator(PICKER_BTN);
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute("aria-haspopup", "dialog");
  });

  test("popover uses the bo-datePop bo-datePop--glass styles and shows the URL date as selected", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);

    const popover = adminPage.locator(PICKER_POPOVER);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveClass(/bo-datePop/);
    await expect(popover).toHaveClass(/bo-datePop--glass/);

    const selected = adminPage.locator(dayCell("2026-04-05"));
    await expect(selected).toBeVisible();
    await expect(selected).toHaveAttribute("data-selected", "true");
  });

  test("selecting a day changes the ?date URL and reloads the map for that date", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);

    const target = adminPage.locator(dayCell("2026-04-06"));
    await target.scrollIntoViewIfNeeded();
    await target.click();

    await adminPage.waitForURL(/\?date=2026-04-06/, { timeout: 5_000 });
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.locator(SHEET_DATE_LABEL)).toHaveText("2026-04-06", { timeout: 10_000 });
  });

  test("after changing the date the picker still reflects it and persists across reload", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);
    await adminPage.locator(dayCell("2026-04-07")).click();
    await adminPage.waitForURL(/\?date=2026-04-07/);
    await waitForLoadingToFinish(adminPage);

    // Reopen: the new date must be highlighted.
    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell("2026-04-07"))).toHaveAttribute("data-selected", "true");

    // Close and reload: the URL keeps the date, so the picker must too.
    await adminPage.keyboard.press("Escape");
    await expect(adminPage.locator(PICKER_POPOVER)).toBeHidden();
    await adminPage.reload();
    await expect(adminPage.locator(MAP_PAGE)).toBeVisible({ timeout: 45_000 });
    await waitForLoadingToFinish(adminPage);

    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell("2026-04-07"))).toHaveAttribute("data-selected", "true");
  });

  test("picking a closed day keeps the header date picker available to switch back", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    // 2026-04-07 is a closed day in the dev DB: the closed-day panel appears.
    await openDatePicker(adminPage);
    await adminPage.locator(dayCell("2026-04-07")).click();
    await adminPage.waitForURL(/\?date=2026-04-07/, { timeout: 5_000 });
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.locator(CLOSED_VIEW)).toBeVisible({ timeout: 10_000 });
    await expect(adminPage.locator(FLOW_WRAPPER)).toBeHidden();

    // The header picker must remain reachable on the closed day so the user can switch.
    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell("2026-04-07"))).toHaveAttribute("data-selected", "true");

    // Switch back to an open day: the map must render again.
    await adminPage.locator(dayCell("2026-04-05")).click();
    await adminPage.waitForURL(/\?date=2026-04-05/, { timeout: 5_000 });
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.locator(FLOW_WRAPPER)).toBeVisible({ timeout: 15_000 });
  });

  test("missing ?date param defaults to today", async ({ adminPage }) => {
    await loadMap(adminPage);

    const today = await todayISOInBrowser(adminPage);

    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell(today))).toHaveAttribute("data-selected", "true");
  });

  test("invalid ?date param falls back to today instead of a broken date", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=not-a-date");

    const today = await todayISOInBrowser(adminPage);

    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell(today))).toHaveAttribute("data-selected", "true");
  });

  test("impossible ?date param (2026-13-45) falls back to today", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-13-45");

    const today = await todayISOInBrowser(adminPage);

    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell(today))).toHaveAttribute("data-selected", "true");
  });

  test("Escape closes the popover and returns focus to the trigger", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);
    await adminPage.keyboard.press("Escape");
    await expect(adminPage.locator(PICKER_POPOVER)).toBeHidden({ timeout: 5_000 });
    await expect(adminPage.locator(PICKER_BTN)).toBeFocused();
  });

  test("clicking outside closes the popover", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);
    await adminPage.mouse.click(50, 300);
    await expect(adminPage.locator(PICKER_POPOVER)).toBeHidden({ timeout: 5_000 });
  });

  test("month navigation works and allows selecting a date in another month", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);

    const monthLabel = adminPage.locator('[data-ui="date-picker-month-label"]');
    await expect(monthLabel).toHaveText(/abril|apr/, { timeout: 5_000 });

    // Next month -> mayo 2026
    await adminPage.locator('[data-ui="date-picker-next-btn"]').click();
    await expect(monthLabel).toHaveText(/mayo|may/, { timeout: 5_000 });

    await adminPage.locator(dayCell("2026-05-02")).click();
    await adminPage.waitForURL(/\?date=2026-05-02/, { timeout: 5_000 });
    await waitForLoadingToFinish(adminPage);

    await expect(adminPage.locator(SHEET_DATE_LABEL)).toHaveText("2026-05-02", { timeout: 10_000 });
  });

  test("prev/next month buttons move the calendar and the header trigger toggles the popover", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);
    const monthLabel = adminPage.locator('[data-ui="date-picker-month-label"]');

    await adminPage.locator('[data-ui="date-picker-prev-btn"]').click();
    await expect(monthLabel).toHaveText(/marzo|mar/, { timeout: 5_000 });

    await adminPage.locator('[data-ui="date-picker-next-btn"]').click();
    await adminPage.locator('[data-ui="date-picker-next-btn"]').click();
    await expect(monthLabel).toHaveText(/mayo|may/, { timeout: 5_000 });

    // Toggle closed by clicking the trigger again.
    await adminPage.locator(PICKER_BTN).click();
    await expect(adminPage.locator(PICKER_POPOVER)).toBeHidden({ timeout: 5_000 });
  });

  test("the date picker label in the header matches the selected day number", async ({ adminPage }) => {
    await loadMap(adminPage, "?date=2026-04-15");

    const label = adminPage.locator(`${PICKER_BTN} [data-slot="datePicker-dateBtnLabel"]`);
    await expect(label).toBeVisible({ timeout: 15_000 });
    await expect(label).toHaveText(/15/);
  });

  test("on narrow viewports the header picker collapses to icon only and still opens the popover", async ({ adminPage }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-standard" && testInfo.project.name !== "mobile-small",
      "responsive layout assertion");

    await loadMap(adminPage, "?date=2026-04-05");

    const label = adminPage.locator(`${PICKER_BTN} [data-slot="datePicker-dateBtnLabel"]`);
    await expect(label).toBeHidden({ timeout: 5_000 });

    // The trigger itself stays visible and tappable.
    await expect(adminPage.locator(PICKER_BTN)).toBeVisible();

    // And opening the popover still shows the full date and selected day.
    await openDatePicker(adminPage);
    await expect(adminPage.locator(dayCell("2026-04-05"))).toHaveAttribute("data-selected", "true");
  });

  test("no critical errors are thrown while opening and using the picker", async ({ adminPage }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    adminPage.on("pageerror", (err) => {
      // Dev server artifact: vite module scripts can fail to load over the
      // tunnel while HMR is mid-rebuild. Unrelated to the feature under test.
      if (!/Importing a module script failed/i.test(String(err.message || ""))) {
        pageErrors.push(err);
      }
    });
    adminPage.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await loadMap(adminPage, "?date=2026-04-05");

    await openDatePicker(adminPage);
    await adminPage.locator('[data-ui="date-picker-next-btn"]').click();
    await adminPage.locator('[data-ui="date-picker-prev-btn"]').click();
    await adminPage.locator(dayCell("2026-04-06")).click();
    await adminPage.waitForURL(/\?date=2026-04-06/);
    await waitForLoadingToFinish(adminPage);

    expect(pageErrors).toEqual([]);
    const relevant = consoleErrors.filter(
      (e) => !/favicon|sourcemap|Importing a module script failed/i.test(e),
    );
    expect(relevant).toEqual([]);
  });
});
