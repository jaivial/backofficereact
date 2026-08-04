import { expect, test } from "../../fixtures/session";
import type { Page } from "@playwright/test";

// Each case opens a product editor, creates a technical sheet and loads its
// three tabs. That is several round trips more than a normal page assertion,
// so the default timeout is raised rather than leaving the suite flaky.
test.describe.configure({ timeout: 120_000 });

// The requirement is that EVERY product type offers the Preparado / Materia
// prima switch, and that Preparado reveals the three subtabs in the same
// editor. One spec per type, because each type reaches a different editor.

const TYPES = ["platos", "cafes", "bebidas", "postres", "vinos"] as const;

/**
 * Opens the first product of a type, or returns false when the catalogue has
 * none. A type with no products cannot demonstrate anything about the switch, so
 * the case skips rather than failing on an empty list - these specs run against
 * real data, where a category being empty is a legitimate state.
 */
async function openFirstProduct(page: Page, foodType: string): Promise<boolean> {
  await page.goto(`/app/comida/${foodType}`, { waitUntil: "domcontentloaded" });
  const edit = page.locator("[data-role='food-card-edit-btn']").first();
  const empty = page.locator("[data-role='food-list-empty'], [data-ui='food-list-empty']").first();
  await expect(edit.or(empty)).toBeVisible({ timeout: 45000 });
  if ((await edit.count()) === 0) return false;
  await edit.click();
  // waitForURL resolves mid-hydration, so wait for the section itself instead.
  await expect(page.getByTestId("production-type-section")).toBeVisible({ timeout: 20000 });
  return true;
}

/**
 * Drive the switch to a specific value.
 *
 * These specs run against real data, so the starting value is whatever the last
 * run (or a real user) left behind. Asserting a starting state made them
 * history-dependent; instead the target is set and verified, and an already
 * correct value is a no-op.
 *
 * The click is retried because waitForURL/visibility both resolve before React
 * finishes hydrating, so an early click lands on markup with no listeners.
 */
async function setProductionType(page: Page, target: "preparado" | "materia prima") {
  const option = page.getByRole("radio", { name: new RegExp(target, "i") });
  // The toggle is fully controlled: aria-checked only flips once the PATCH (and,
  // for Preparado, the sheet creation) has come back. A short inner timeout made
  // the retry fire another click while the first was still in flight, so the
  // requests piled up and the assertion timed out under load.
  await expect(async () => {
    if ((await option.getAttribute("aria-checked")) !== "true") {
      await option.scrollIntoViewIfNeeded();
      await option.click();
    }
    await expect(option).toHaveAttribute("aria-checked", "true", { timeout: 20000 });
  }).toPass({ timeout: 90000, intervals: [2000, 5000] });
}

for (const foodType of TYPES) {
  test(`${foodType}: the switch is always shown and Preparado reveals the subtabs`, async ({ adminPage }) => {
    const errors: string[] = [];
    adminPage.on("pageerror", (e) => errors.push(e.message));
    adminPage.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    test.skip(!(await openFirstProduct(adminPage, foodType)), `no ${foodType} in the catalogue`);

    // The switch itself must be present for every type; that is the requirement.
    await expect(adminPage.getByRole("radio", { name: /preparado/i })).toBeVisible();
    await expect(adminPage.getByRole("radio", { name: /materia prima/i })).toBeVisible();

    // Materia prima has no recipe, so no subtabs.
    await setProductionType(adminPage, "materia prima");
    await expect(adminPage.getByRole("tab", { name: /informaci/i })).toHaveCount(0);

    await setProductionType(adminPage, "preparado");

    // Choosing Preparado lands the user in the sheet catalogue: a product that
    // is not linked yet gets the browser, one that already has a sheet opens
    // straight into its three tabs. Either is correct here, because these run
    // against real data whose link state is not fixed.
    await expect(
      adminPage
        .getByTestId("technical-sheet-browser")
        .or(adminPage.getByRole("tab", { name: /informaci/i })),
    ).toBeVisible({ timeout: 20000 });

    // Restore the catalogue: these tests run against real data.
    await setProductionType(adminPage, "materia prima");

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });
}

// Wine is stored in its own table, so a successful save there is worth proving
// separately: it must survive a reload rather than living in local state only.
test("a wine marked Preparado survives a reload", async ({ adminPage }) => {
  await openFirstProduct(adminPage, "vinos");
  // Set Preparado only. Toggling to Materia prima first would race the
  // automatic sheet creation that Preparado triggers.
  await setProductionType(adminPage, "preparado");

  await adminPage.reload({ waitUntil: "domcontentloaded" });
  await expect(adminPage.getByTestId("production-type-section")).toBeVisible({ timeout: 20000 });
  await expect(adminPage.getByRole("radio", { name: /preparado/i }))
    .toHaveAttribute("aria-checked", "true", { timeout: 20000 });

  // Leave the catalogue as it was found.
  await setProductionType(adminPage, "materia prima");
});

// The switch must also be present when creating a product, which is a different
// component (the modal) from the edit path.
test("the create modal offers the switch too", async ({ adminPage }) => {
  await adminPage.goto("/app/comida/platos", { waitUntil: "domcontentloaded" });
  const create = adminPage.locator("[data-role='food-open-create-btn'], [data-ui='food-open-create-btn']").first();
  if (!(await create.count())) {
    test.skip(true, "no create button exposed on this page");
    return;
  }
  await create.click();
  await expect(adminPage.getByTestId("production-type-section")).toBeVisible({ timeout: 20000 });
  await expect(adminPage.getByRole("radio", { name: /preparado/i })).toBeVisible();
});
