import { test, expect } from "../../fixtures/session";
import { TestApiClient } from "../../helpers/api-client";

// Full flow from login (session seeded by global-setup using the .env admin
// credentials) → Config → IA tab → WhatsApp bot connection panel + the
// documented API contracts.
test.describe("WhatsApp Bot connection (Config → IA)", () => {
  test("login session is valid (whoami)", async ({ adminPage }) => {
    await adminPage.goto("/app/config");
    const api = new TestApiClient(adminPage);
    const me = await api.get<any>("/api/admin/me");
    expect(me?.session?.user?.email).toBeTruthy();
    // The IA tab is root-only; the flow requires a root session.
    expect(me?.session?.user?.role).toBe("root");
  });

  test("panel renders on the IA tab and settles to a known state", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=ia");
    await adminPage.waitForLoadState("networkidle");
    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute(
      "data-state",
      /not_subscribed|disconnected|pending|connected/,
    );
  });

  test("disconnected state exposes QR connect + pairing-code input; subscribed shows activate", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=ia");
    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    await expect(panel).toBeVisible();
    const state = await panel.getAttribute("data-state");

    if (state === "disconnected") {
      await expect(panel.getByRole("button", { name: /Conectar con QR/i })).toBeVisible();
      // F1: pairing-code path is now reachable (phone input + button).
      await expect(panel.getByLabel(/Número de teléfono para vinculación/i)).toBeVisible();
      await expect(panel.getByRole("button", { name: /Vincular con código/i })).toBeVisible();
    } else if (state === "not_subscribed") {
      await expect(panel.getByRole("button", { name: /Activar WhatsApp Pack/i })).toBeVisible();
    } else if (state === "connected") {
      // F2: cancel-subscription action is wired.
      await expect(panel.getByRole("button", { name: /Cancelar suscripción/i })).toBeVisible();
    }
  });

  test("GET /connection returns the documented contract", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=ia");
    const api = new TestApiClient(adminPage);
    const res = await api.get<any>("/api/admin/members/whatsapp/connection");
    expect(res).toHaveProperty("success", true);
    expect(res).toHaveProperty("connected");
    expect(res).toHaveProperty("connection");
  });

  test("superadmin server pool endpoint is reachable for root", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=ia");
    const api = new TestApiClient(adminPage);
    const res = await api.get<any>("/api/admin/integrations/uazapi/servers");
    expect(res).toHaveProperty("success", true);
    expect(Array.isArray(res?.data?.servers)).toBe(true);
  });
});
