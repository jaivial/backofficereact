import { test, expect } from "../../fixtures/session";
import { TestApiClient } from "../../helpers/api-client";
import { waitForLoadingToFinish } from "../../helpers/wait";

/** Real-app member contact flow: no request interception or mocked internals. */
test.describe("Miembros - WhatsApp contact", () => {
  test("adds a phone from the member WhatsApp composer", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const ts = Date.now();
    const created = await api.post<{ success: boolean; member?: { id: number } }>(
      "/api/admin/members",
      {
        firstName: `WhatsApp${ts}`,
        lastName: "Contact",
        email: `e2e-whatsapp-${ts}@test.com`,
        roleSlug: "admin",
        dni: `${ts}WAP`,
      },
    );
    expect(created.success).toBe(true);
    expect(created.member?.id).toBeGreaterThan(0);
    const memberId = created.member!.id;

    await adminPage.goto("/app/miembros");
    await adminPage.waitForLoadState("networkidle");
    await waitForLoadingToFinish(adminPage);

    const card = adminPage.getByRole("link", { name: new RegExp(`WhatsApp${ts}\\s+Contact`) });
    await expect(card).toBeVisible();
    await card.locator(`button[data-member-id="${memberId}"]`).click();

    const dialog = adminPage.getByRole("dialog", { name: "WhatsApp" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("no tiene un número de WhatsApp");

    const phone = dialog.getByRole("textbox", { name: /Teléfono de WhatsApp/i });
    await phone.fill("612345678");
    await dialog.getByRole("button", { name: "Guardar teléfono" }).click();

    await expect(dialog).toContainText("Mensaje para WhatsApp");
    await expect(dialog.locator("#member-whatsapp-message")).toBeVisible();
    // Verify persistence through the real API, not only the rendered state.
    const detail = await api.get<{ success: boolean; member?: { id: number; phone?: string; whatsappNumber?: string } }>(`/api/admin/members/${memberId}`);
    expect(detail.success).toBe(true);
    expect(detail.member?.id).toBe(memberId);
    expect(detail.member?.phone ?? detail.member?.whatsappNumber).toContain("612345678");
  });

  test("rejects an invalid WhatsApp verification code through the real API", async ({ adminPage }) => {
    const api = new TestApiClient(adminPage);
    const ts = Date.now();
    const created = await api.post<{ success: boolean; member?: { id: number } }>(
      "/api/admin/members",
      { firstName: `Verify${ts}`, lastName: "Contact", email: `e2e-verify-${ts}@test.com`, roleSlug: "admin", dni: `${ts}VER` },
    );
    expect(created.success).toBe(true);
    const response = await api.post<{ success: boolean; code?: string }>(
      `/api/admin/members/${created.member!.id}/whatsapp/verification/confirm`,
      { code: "000000" },
    );
    expect(response.success).toBe(false);
    expect(response.code).toBe("INVALID_CODE");
  });
});
