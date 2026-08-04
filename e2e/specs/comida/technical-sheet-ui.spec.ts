import { expect, test } from "../../fixtures/session";

// Reproduces the reported problem: open a dish from /app/comida and check the
// technical-sheet controls are actually present in the modal.
test("the dish modal exposes the production type and sheet controls", async ({ adminPage }) => {
  const errors: string[] = [];
  adminPage.on("pageerror", (e) => errors.push(e.message));
  adminPage.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await adminPage.goto("/app/comida/platos", { waitUntil: "domcontentloaded" });

  // Open the first dish; editing an existing dish is where the section applies.
  // "Editar" navigates to the dish detail page, which is where the quick
  // editor (and therefore the technical sheet section) lives.
  const editButton = adminPage.locator("[data-role='food-card-edit-btn']").first();
  await editButton.waitFor({ state: "visible", timeout: 20000 });
  await editButton.click();
  await adminPage.waitForURL(/\/app\/comida\/platos\/\d+/, { timeout: 20000 });

  const toggle = adminPage.getByTestId("production-type-toggle");
  await expect(toggle).toBeVisible({ timeout: 15000 });
  await expect(adminPage.getByRole("radio", { name: /materia prima/i })).toBeVisible();
  await expect(adminPage.getByRole("radio", { name: /preparado/i })).toBeVisible();

  console.log("[ui] page/console errors:", JSON.stringify(errors));
  expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
});
