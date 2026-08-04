import { expect, test } from "../../fixtures/session";

test.describe.configure({ timeout: 180_000 });

// Drives the create modal to Preparado and checks the reworked UI, in the real
// browser against the real backend.
test("the create modal shows the reworked layout and sheet tabs", async ({ adminPage }) => {
  const errors: string[] = [];
  adminPage.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  adminPage.on("pageerror", (error) => errors.push(String(error)));

  await adminPage.goto("/app/comida/platos", { waitUntil: "domcontentloaded" });

  const create = adminPage.locator("[data-role='food-list-create-btn']").first();
  await create.waitFor({ state: "visible", timeout: 60_000 });

  // The SSR markup is identical before hydration, so a click can land on an
  // element whose handler is not attached yet and be silently lost. Retry until
  // the modal actually opens.
  const fields = adminPage.locator("[data-slot='food-modal-fields']");
  await expect(async () => {
    await create.click();
    await expect(fields).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 90_000, intervals: [1_000, 2_000, 3_000] });

  // 1. The image block is inside the fields column now, not a sibling sidebar.
  await expect(fields.locator("[data-slot='food-modal-image-section']")).toHaveCount(1);

  // 4. Every allergen card is the same size.
  const cards = adminPage.locator("[data-role='food-modal-alergeno-option']");
  await expect(cards.first()).toBeVisible();
  const sizes = await cards.evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return `${Math.round(rect.width)}x${Math.round(rect.height)}`;
    }),
  );
  expect(new Set(sizes).size, `allergen card sizes: ${JSON.stringify(sizes)}`).toBe(1);

  // 5. Preparado reveals the three tabs, rendered by the shared Tabs component.
  const preparado = adminPage.getByRole("radio", { name: /preparado/i });
  await expect(async () => {
    await preparado.scrollIntoViewIfNeeded();
    await preparado.click();
    await expect(preparado).toHaveAttribute("aria-checked", "true", { timeout: 5_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000] });

  // 5. Preparado now opens the sheet browser: search, filters, cards, and a
  // create action top right. Nothing is created until it is asked for.
  const browser = adminPage.getByTestId("technical-sheet-browser");
  await expect(browser).toBeVisible({ timeout: 30_000 });
  await expect(browser.getByRole("searchbox", { name: /buscar ficha/i })).toBeVisible();
  await expect(browser.getByRole("button", { name: /^categoria$/i })).toBeVisible();
  await expect(browser.getByRole("button", { name: /^estado$/i })).toBeVisible();
  const createSheet = adminPage.locator("[data-role='sheet-browser-create']");
  await expect(createSheet).toBeVisible();

  // The editor only appears once a sheet exists.
  await expect(adminPage.getByTestId("technical-sheet-editor")).toHaveCount(0);
  await createSheet.click();

  const tablist = adminPage.getByRole("tablist", { name: /secciones de la ficha/i });
  await expect(tablist).toBeVisible({ timeout: 30_000 });

  // A left chevron returns to the list, pinned to the panel corner rather than
  // taking a row of its own.
  const back = adminPage.locator("[data-role='sheet-back']");
  await expect(back).toBeVisible();
  await expect(back).toHaveCSS("position", "absolute");
  const backBox = (await back.boundingBox())!;
  const tabsBox = (await tablist.boundingBox())!;
  // It must not cover the tabs, or it would block the first one. The button now
  // shares their vertical band, so the check is a real rectangle intersection
  // rather than "is it above them".
  const overlaps =
    backBox.x < tabsBox.x + tabsBox.width &&
    backBox.x + backBox.width > tabsBox.x &&
    backBox.y < tabsBox.y + tabsBox.height &&
    backBox.y + backBox.height > tabsBox.y;
  expect(overlaps, `back ${JSON.stringify(backBox)} vs tabs ${JSON.stringify(tabsBox)}`).toBe(false);
  await expect(tablist.locator(".bo-tab")).toHaveCount(3);

  // The duplicated sheet-name heading was removed.
  await expect(
    adminPage.locator("[data-testid='technical-sheet-editor'] > .bo-sectionTitle"),
  ).toHaveCount(0);

  // 6. Ingredients: the add button opens the search popover.
  await adminPage.locator("[data-role='sheet-add-ingredient']").click();
  const picker = adminPage.getByTestId("ingredient-picker-popover");
  await expect(picker).toBeVisible({ timeout: 15_000 });
  await picker.getByRole("searchbox", { name: /buscar/i }).fill("po");
  // Real data: either results or an explicit empty message, never a blank box.
  await expect(
    picker.locator(".bo-sheetSearchItem").first().or(picker.locator(".bo-popover__empty")),
  ).toBeVisible({ timeout: 20_000 });
  // Escape would bubble to the Modal and close the whole editor, so the popover
  // is dismissed with its own toggle.
  await adminPage.locator("[data-role='sheet-add-ingredient']").click();
  await expect(picker).toBeHidden({ timeout: 10_000 });

  // The allergen popover reuses the same card grid.
  // The sheet's allergen grid is the same component as the product editor's, so
  // a card in one must measure the same as a card in the other.
  const modalCard = await adminPage
    .locator("[data-role='food-modal-alergeno-option']")
    .first()
    .boundingBox();

  const allergenToggle = adminPage.locator("[data-role='sheet-add-allergen']");
  await allergenToggle.click();
  const allergenPicker = adminPage.getByTestId("allergen-picker-popover");
  await expect(allergenPicker).toBeVisible({ timeout: 15_000 });

  // Picking one has to persist and render as a chip. The PATCH response used to
  // omit the effective list, so the chip never appeared.
  await allergenPicker.getByRole("button", { name: /^leche$/i }).click();
  await expect(allergenPicker).toBeHidden({ timeout: 10_000 });
  const sheetCardLocator = adminPage.locator(
    "[data-role='sheet-alergeno-option'][data-allergen='Leche']",
  );
  await expect(sheetCardLocator).toBeVisible({ timeout: 20_000 });

  // Same grid means the same card geometry, not merely a similar look.
  const sheetCard = await sheetCardLocator.boundingBox();
  expect(Math.round(sheetCard?.width ?? 0)).toBe(Math.round(modalCard?.width ?? -1));
  expect(Math.round(sheetCard?.height ?? 0)).toBe(Math.round(modalCard?.height ?? -1));

  // ...and it must survive a reload of the sheet data, not just the optimistic
  // render.
  await tablist.getByRole("tab", { name: /receta/i }).click();
  await tablist.getByRole("tab", { name: /informaci/i }).click();
  await expect(sheetCardLocator).toBeVisible({ timeout: 20_000 });

  // Leave the sheet as it was found: clicking a selected, unlocked card removes it.
  await sheetCardLocator.click();
  await expect(sheetCardLocator).toBeHidden({ timeout: 20_000 });

  const infoPadding = await adminPage
    .locator("[data-ui='sheet-info-tab']")
    .evaluate((node) => getComputedStyle(node).paddingInlineStart);
  expect(infoPadding).toBe("32px");

  // Receta: a step card is editable and offers the 1:1 image placeholder.
  await tablist.getByRole("tab", { name: /receta/i }).click();
  const title = adminPage.getByLabel(/titulo del paso 1/i);
  // Adding a step is a round trip plus a re-render, and under load the click can
  // land before the tab panel has settled. Retry until the step exists.
  await expect(async () => {
    if ((await title.count()) === 0) {
      await adminPage.getByRole("button", { name: /anadir paso/i }).click();
    }
    await expect(title).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000, intervals: [1_000, 2_000, 3_000] });
  await expect(title).toBeEditable();
  const addImage = adminPage.getByRole("button", { name: /anadir imagen al paso 1/i });
  await expect(addImage).toBeVisible();
  const box = await addImage.boundingBox();
  // The placeholder must be square, so the row does not jump when a photo lands.
  expect(Math.abs((box?.width ?? 0) - (box?.height ?? 0))).toBeLessThan(4);
  await addImage.click();
  await expect(adminPage.getByTestId("step-image-popover")).toBeVisible({ timeout: 15_000 });
  await addImage.click();
  await expect(adminPage.getByTestId("step-image-popover")).toBeHidden({ timeout: 10_000 });

  // Coste: with no priced ingredients it must explain itself, not show an empty table.
  await tablist.getByRole("tab", { name: /coste/i }).click();
  await expect(adminPage.getByTestId("sheet-cost-tab")).toBeVisible({ timeout: 20_000 });

  // Back to the list, then into the sheet again: both directions must work.
  await back.click();
  await expect(browser).toBeVisible({ timeout: 20_000 });
  await expect(adminPage.getByTestId("technical-sheet-editor")).toHaveCount(0);

  const fatal = errors.filter((text) => !/favicon|ResizeObserver/i.test(text));
  expect(fatal, `console errors: ${JSON.stringify(fatal, null, 2)}`).toEqual([]);
});
