import { test, expect } from "../../fixtures/session";

test("food hub FAB opens type onboarding without navigation", async ({ adminPage }) => {
  await adminPage.goto("/app/comida");
  await expect(adminPage).toHaveURL(/\/app\/comida$/);

  await adminPage.getByRole("button", { name: "Crear elemento de comida" }).click();

  await expect(adminPage).toHaveURL(/\/app\/comida$/);
  const modal = adminPage.getByRole("dialog", { name: "Crear elemento de comida" });
  await expect(modal).toHaveClass(/bo-modal/);
  await expect(modal).toHaveClass(/bo-modal--glass/);
  await expect(modal.getByRole("button", { name: "Plato" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Bebida" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Vino" })).toBeVisible();
  await expect(modal.getByRole("button", { name: "Cafe" })).toBeVisible();
});
