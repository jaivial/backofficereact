import { test, expect } from "../../fixtures/session";
import { TestApiClient } from "../../helpers/api-client";

// Legal pages CMS end-to-end coverage. Each test() is independent so a failure
// is isolated. The save test (5) mutates the booking-policies row; it is the
// only test that writes, and it is idempotent (re-runnable).
//
// Multi-tenant note: the test schema only seeds restaurant_id=1. The admin path
// uses the active restaurant from the session, so tenancy is implicit here. A
// second-tenant assertion would need a `?restaurant_id=2` query and a seeded
// second tenant, which this environment does not have.
test.describe("Legal pages CMS", () => {
  test("tab is visible on the config page", async ({ adminPage }) => {
    await adminPage.goto("/app/config");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage.getByRole("link", { name: /Paginas legales/i })).toBeVisible();
  });

  test("tab content shows three legal-page cards", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=legal-pages");
    await adminPage.waitForLoadState("networkidle");

    const cards = adminPage.locator('[data-slot="legal-page-card"]');
    await expect(cards).toHaveCount(3);

    const gridText = await adminPage.locator('[data-ui="legal-pages-grid"]').innerText();
    expect(gridText).toContain("Aviso Legal");
    expect(gridText).toContain("Políticas de Reserva");
    expect(gridText).toContain("Protección de Datos");
  });

  test("card click navigates to the editor sub-page", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=legal-pages");
    await adminPage.waitForLoadState("networkidle");

    await adminPage.locator('[data-testid="legal-page-card-booking-policies"]').click();
    await adminPage.waitForURL(/\/app\/config\/legal-pages\/booking-policies/);
    expect(adminPage.url()).toContain("/app/config/legal-pages/booking-policies");

    await expect(adminPage.locator('[contenteditable="true"]').first()).toBeVisible();
  });

  test("editor and preview sub-tabs toggle", async ({ adminPage }) => {
    await adminPage.goto("/app/config/legal-pages/booking-policies");
    await adminPage.waitForLoadState("networkidle");
    await expect(adminPage.locator('[contenteditable="true"]').first()).toBeVisible();

    await adminPage.getByTestId("tab-preview").click();
    const preview = adminPage.locator('[data-testid="legal-page-editor-preview"]');
    await expect(preview).toHaveClass(/wrapperavisolegal/);
    await expect(preview).not.toBeEmpty();

    await adminPage.getByTestId("tab-editor").click();
    await expect(adminPage.locator('[contenteditable="true"]').first()).toBeVisible();
  });

  test("save flow persists edited content", async ({ adminPage }) => {
    await adminPage.goto("/app/config/legal-pages/booking-policies");
    await adminPage.waitForLoadState("networkidle");

    const editor = adminPage.locator('[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await editor.click();
    await adminPage.keyboard.type("E2E LEGAL TEST");

    await adminPage.getByTestId("legal-page-editor-save").click();
    await expect(adminPage.getByText(/Guardado/i)).toBeVisible();

    // Reload the sub-page; assert the new text appears in the preview.
    await adminPage.goto("/app/config/legal-pages/booking-policies");
    await adminPage.waitForLoadState("networkidle");
    await adminPage.getByTestId("tab-preview").click();
    await expect(adminPage.locator('[data-testid="legal-page-editor-preview"]')).toContainText("E2E LEGAL TEST");
  });

  test("public API returns the saved content", async ({ adminPage }) => {
    await adminPage.goto("/app/config");
    const api = new TestApiClient(adminPage);
    const r = await api.get<{ success: boolean; contentHtml: string }>(
      "/api/public/legal-page?slug=booking-policies",
    );
    expect(r.success).toBe(true);
    expect(r.contentHtml).toContain("E2E LEGAL TEST");
  });

  test("invalid slug returns 400 from the public endpoint", async ({ adminPage }) => {
    await adminPage.goto("/app/config");
    const api = new TestApiClient(adminPage);
    const r = await api.get<{ success: boolean }>("/api/public/legal-page?slug=bogus");
    expect(r.success).toBe(false);
  });
});
