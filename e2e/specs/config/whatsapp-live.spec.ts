import { test, expect } from "../../fixtures/session";

test.describe.serial("WhatsApp live onboarding", () => {
  test("disconnects, generates a real QR, then cleans up", async ({ adminPage }) => {
    test.skip(process.env.E2E_WHATSAPP_LIVE_CONNECT !== "1", "Set E2E_WHATSAPP_LIVE_CONNECT=1");

    const pageErrors: string[] = [];
    const missingAPIs: string[] = [];
    adminPage.on("pageerror", (error) => pageErrors.push(error.message));
    adminPage.on("response", (response) => {
      const path = new URL(response.url()).pathname;
      if (response.status() === 404 && path.startsWith("/api/admin/")) missingAPIs.push(path);
    });

    await adminPage.goto("/app/config?content=contacto");
    const whoami = await adminPage.evaluate(async () => (await fetch("/api/admin/me")).json());
    expect(whoami?.session?.activeRestaurantId).toBe(1);

    const disconnectAPI = () => adminPage.evaluate(async () => {
      const response = await fetch("/api/admin/members/whatsapp/disconnect", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ delete_instance: false }),
      });
      return { status: response.status, body: await response.json() };
    });

    // Start deterministic: local inactive + provider logout.
    const cleanupBefore = await disconnectAPI();
    expect(cleanupBefore.status).toBe(200);
    await adminPage.waitForTimeout(1500);
    await adminPage.reload();

    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    await expect(panel).toHaveAttribute("data-state", "disconnected", { timeout: 10_000 });
    try {
      await panel.getByRole("button", { name: "Conectar WhatsApp" }).click();
      await expect(panel).toHaveAttribute("data-state", "qr_ready", { timeout: 50_000 });

      const qr = panel.getByAltText("Código QR para vincular WhatsApp");
      await expect(qr).toBeVisible();
      await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
      await expect.poll(() => qr.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
      await expect(panel).toContainText("Dispositivos vinculados");
    } finally {
      const cleanupAfter = await disconnectAPI();
      expect(cleanupAfter.status).toBe(200);
      await adminPage.reload();
      await expect(panel).toHaveAttribute("data-state", "disconnected", { timeout: 10_000 });
    }

    expect(missingAPIs).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
