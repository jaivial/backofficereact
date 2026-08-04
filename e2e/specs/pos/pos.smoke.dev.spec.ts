import { expect, test } from "../../fixtures/session";

// Real-backend smoke: runs against BACKOFFICE_URL with no route mocking.
// Requires POS enabled and the Carta catalogue imported for the tenant.
test("POS dev smoke: bootstrap renders tables and catalogue", async ({ adminPage: page }) => {
  await page.goto("/app/pos");
  await expect(page.getByTestId("pos-view-switcher")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("pos-control-rail")).toBeVisible();
  // Catalogue tiles come from the imported Carta.
  await expect(page.getByTestId("pos-category-Arroces")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pos-category-Bebidas")).toBeVisible();
  // Tables live in the Mesa modal.
  await page.getByTestId("pos-rail-mesa").click();
  await expect(page.getByText("Mesa 1")).toBeVisible();
  await expect(page.getByText("Terraza 1")).toBeVisible();
});
