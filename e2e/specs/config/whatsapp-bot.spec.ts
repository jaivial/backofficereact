import { test, expect } from "../../fixtures/session";
import { TestApiClient } from "../../helpers/api-client";

test.describe("WhatsApp bot connection in Contact config", () => {
  test("settings no longer renders WhatsApp connection", async ({ adminPage }) => {
    await adminPage.goto("/app/settings");
    await expect(adminPage.locator('[data-ui="whatsapp-connection"]')).toHaveCount(0);
  });

  test("Contact config makes no missing API requests", async ({ adminPage }) => {
    const missing: string[] = [];
    adminPage.on("response", (response) => {
      const url = new URL(response.url());
      if (response.status() === 404 && url.pathname.startsWith("/api/admin/")) missing.push(url.pathname);
    });
    await adminPage.goto("/app/config?content=contacto");
    await adminPage.waitForTimeout(500);
    expect(missing).toEqual([]);
  });

  test("real session is restaurant 1", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=contacto");
    const api = new TestApiClient(adminPage);
    const me = await api.get<any>("/api/admin/me");
    expect(me?.session?.user?.email).toBeTruthy();
    expect(me?.session?.activeRestaurantId).toBe(1);
  });

  test("Contact panel renders subscribed flow", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=contacto");
    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("data-state", /disconnected|provisioning|qr_ready|connected|error/);

    const state = await panel.getAttribute("data-state");
    if (state === "disconnected") {
      await expect(panel.getByRole("button", { name: "Conectar WhatsApp", exact: true })).toBeVisible();
      await expect(panel.getByLabel(/Número de teléfono/i)).toHaveCount(0);
    } else if (state === "connected") {
      await expect(panel.getByRole("button", { name: "Desconectar WhatsApp" })).toBeVisible();
    }
  });

  test("Contact hides panel when subscription check denies entitlement", async ({ adminPage }) => {
    await adminPage.routeWebSocket("**/api/admin/members/whatsapp/ws", () => {});
    await adminPage.route("**/api/admin/members/whatsapp/connection", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, entitled: false, connected: false, code: "NEEDS_SUBSCRIPTION", connection: null }),
      });
    });
    await adminPage.goto("/app/config?content=contacto");
    await expect(adminPage.locator('[data-ui="whatsapp-connection"]')).toHaveCount(0);
  });

  test("authenticated WebSocket sends restaurant-scoped snapshot", async ({ adminPage }) => {
    const wsPromise = adminPage.waitForEvent("websocket", {
      predicate: (socket) => socket.url().includes("/api/admin/members/whatsapp/ws"),
    });
    await adminPage.goto("/app/config?content=contacto");
    const socket = await wsPromise;
    const frame = await socket.waitForEvent("framereceived");
    const snapshot = JSON.parse(String(frame.payload));

    expect(snapshot).toMatchObject({
      type: "whatsapp.connection",
      restaurantId: 1,
      success: true,
    });
    expect(snapshot).toHaveProperty("entitled");
    expect(snapshot).not.toHaveProperty("instance_token");
    expect(snapshot).not.toHaveProperty("admin_token");
  });

  test("connection status uses documented safe contract", async ({ adminPage }) => {
    await adminPage.goto("/app/config?content=contacto");
    const api = new TestApiClient(adminPage);
    const res = await api.get<any>("/api/admin/members/whatsapp/connection");

    expect(res).toMatchObject({ success: true, entitled: true });
    expect(typeof res.connected).toBe("boolean");
    expect(res).toHaveProperty("connection");
    expect(res?.connection ?? {}).not.toHaveProperty("server_base_url");
    expect(res?.connection ?? {}).not.toHaveProperty("instance_name");
    expect(res?.connection ?? {}).not.toHaveProperty("provider_instance_id");
  });

  test("pending connection does not poll status", async ({ adminPage }) => {
    let requests = 0;
    adminPage.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/admin/members/whatsapp/connection") requests += 1;
    });

    await adminPage.goto("/app/config?content=contacto");
    await expect(adminPage.locator('[data-ui="whatsapp-connection"]')).toBeVisible();
    await adminPage.waitForTimeout(3500);
    expect(requests).toBeLessThanOrEqual(1);
  });

  test("QR response renders scan instructions in real app", async ({ adminPage }) => {
    await adminPage.routeWebSocket("**/api/admin/members/whatsapp/ws", () => {});
    await adminPage.route("**/api/admin/members/whatsapp/connection", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, entitled: true, connected: false, connection: null }),
      });
    });
    await adminPage.route("**/api/admin/members/whatsapp/connect", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          entitled: true,
          connected: false,
          connection: { status: "pending", connected: false, qr: "iVBORw0KGgo=" },
        }),
      });
    });
    await adminPage.goto("/app/config?content=contacto");
    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    await panel.getByRole("button", { name: "Conectar WhatsApp", exact: true }).click();
    await expect(panel).toHaveAttribute("data-state", "qr_ready");
    await expect(panel.getByAltText("Código QR para vincular WhatsApp")).toBeVisible();
    await expect(panel).toContainText("Dispositivos vinculados");
  });

  test("disconnect uses modal and leaves loading state", async ({ adminPage }) => {
    await adminPage.routeWebSocket("**/api/admin/members/whatsapp/ws", () => {});
    await adminPage.route("**/api/admin/members/whatsapp/connection", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          entitled: true,
          connected: true,
          connection: { status: "connected", connected: true, phone: "34692747052" },
        }),
      });
    });
    await adminPage.route("**/api/admin/members/whatsapp/disconnect", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, entitled: true, connected: false, connection: null }),
      });
    });

    await adminPage.goto("/app/config?content=contacto");
    await adminPage.getByRole("button", { name: "Desconectar WhatsApp" }).click();
    const dialog = adminPage.getByRole("dialog", { name: "Desconectar WhatsApp" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Desconectar" }).click();
    await expect(dialog.getByRole("button", { name: "Procesando..." })).toBeDisabled();
    await expect(dialog).toBeHidden();
    await expect(adminPage.locator('[data-ui="whatsapp-connection"]')).toHaveAttribute("data-state", "disconnected");
  });

  test("live WhatsApp provisioning", async ({ adminPage }) => {
    test.skip(process.env.E2E_WHATSAPP_LIVE_CONNECT !== "1", "Requires configured WhatsApp provider");
    await adminPage.goto("/app/config?content=contacto");
    const panel = adminPage.locator('[data-ui="whatsapp-connection"]');
    const initialState = await panel.getAttribute("data-state");
    if (initialState === "connected") {
      await expect(panel.getByRole("button", { name: "Desconectar WhatsApp" })).toBeVisible();
      return;
    }
    if (initialState === "qr_ready") {
      await expect(panel.getByAltText("Código QR para vincular WhatsApp")).toBeVisible();
      return;
    }
    await panel.getByRole("button", { name: "Conectar WhatsApp", exact: true }).click();
    await expect(panel).toHaveAttribute("data-state", /qr_ready|connected/, { timeout: 30_000 });
    if ((await panel.getAttribute("data-state")) === "qr_ready") {
      await expect(panel.getByAltText("Código QR para vincular WhatsApp")).toBeVisible();
    }
  });
});
