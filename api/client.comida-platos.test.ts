import { describe, expect, it } from "vitest";

import { createClient } from "./client";

function mockFetch(responses: Record<string, unknown>) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET", body: init?.body as string });
    const key = Object.keys(responses).find((k) => url.includes(k));
    const body = key ? responses[key] : { success: false, message: "not found" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

describe("comida.platos", () => {
  describe("list", () => {
    it("RED: should call primary /api/admin/platos endpoint, not skip to fallback /api/admin/menus/dia", async () => {
      // Given a primary endpoint that returns platos
      const platosResponse = {
        success: true,
        items: [
          { num: 1, nombre: "Paella", tipo: "PRINCIPAL", precio: 18, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false },
          { num: 2, nombre: "Ensalada", tipo: "ENTRANTE", precio: 10, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false },
        ],
        total: 2,
        page: 1,
        limit: 24,
      };
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos": platosResponse,
        "/api/admin/menus/dia": {
          success: true,
          menu: { dishes: [], tipo: [], price: "" },
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.comida.platos.list({ page: 1, pageSize: 24 });

      // THEN: should succeed and return items
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.items.length).toBe(2);
        expect(res.items[0].nombre).toBe("Paella");
      }

      // THEN: should have called the PRIMARY endpoint /api/admin/platos
      const primaryCall = calls.find((c) => c.url.includes("/api/admin/platos") && !c.url.includes("menus"));
      expect(primaryCall, "Should call primary /api/admin/platos endpoint before falling back").toBeDefined();
      expect(primaryCall!.method).toBe("GET");
    });

    it("RED: should use primary endpoint and not fallback when primary succeeds", async () => {
      const platosResponse = {
        success: true,
        items: [{ num: 1, nombre: "Test Plato", tipo: "PRINCIPAL", precio: 12, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false }],
        total: 1,
        page: 1,
        limit: 24,
      };
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos": platosResponse,
        "/api/admin/menus/dia": {
          success: true,
          menu: { dishes: [], tipo: [], price: "" },
        },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.comida.platos.list({ page: 1, pageSize: 24 });

      expect(res.success).toBe(true);

      // The fallback /api/admin/menus/dia should NOT be called
      const fallbackCall = calls.find((c) => c.url.includes("/api/admin/menus/dia") && !c.url.includes("dishes"));
      expect(fallbackCall, "Should NOT call fallback when primary succeeds").toBeUndefined();
    });

    it("should still fallback when primary endpoint fails with HTTP error", async () => {
      // Given primary returns HTTP 500 error (triggers throw → fallback)
      const responses: Record<string, unknown> = {
        "/api/admin/platos": { __status: 500, success: false, message: "Internal error" },
        "/api/admin/menus/dia": {
          success: true,
          menu: {
            dishes: [
              { num: 1, tipo: "PRINCIPAL", descripcion: "Paella 15 €", activo: true, alergenos: [] },
            ],
            tipo: [],
            price: "",
          },
        },
      };

      const calls: { url: string; method: string; body?: string }[] = [];
      const fetchWithStatus: typeof fetch = async (input, init) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET", body: init?.body as string });
        const key = Object.keys(responses).find((k) => url.includes(k));
        const body = key ? responses[key] : { success: false, message: "not found" };
        const httpStatus = (body && typeof body === "object" && "__status" in body)
          ? (body as any).__status as number
          : 200;
        const cleanBody = { ...(body as any) };
        delete cleanBody.__status;
        return new Response(JSON.stringify(cleanBody), {
          status: httpStatus,
          headers: { "content-type": "application/json" },
        });
      };

      const client = createClient({ baseUrl: "", fetchImpl: fetchWithStatus });
      const res = await client.comida.platos.list({ page: 1, pageSize: 24 });

      // Should fall back to menu endpoint and get items from there
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.items.length).toBeGreaterThan(0);
      }

      // Both endpoints should have been called (primary first, then fallback)
      const primaryCall = calls.find((c) => c.url.includes("/api/admin/platos") && !c.url.includes("menus"));
      const fallbackCall = calls.find((c) => c.url.includes("/api/admin/menus/dia") && !c.url.includes("dishes"));
      expect(primaryCall).toBeDefined();
      expect(fallbackCall).toBeDefined();
    });
  });

  describe("create", () => {
    it("RED: should call primary /api/admin/platos POST endpoint, not skip to fallback", async () => {
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos": { success: true, num: 42 },
        "/api/admin/menus/dia/dishes": { success: true, dish: { num: 99 } },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const input = { nombre: "Test Plato", precio: 15, tipo: "PRINCIPAL" };
      const res = await client.comida.platos.create(input);

      expect(res.success).toBe(true);
      if (res.success) {
        // Should get num from PRIMARY endpoint (42), not fallback (99)
        expect(res.num).toBe(42);
      }

      const primaryCall = calls.find((c) => c.url === "/api/admin/platos" && c.method === "POST");
      expect(primaryCall, "Should call primary POST /api/admin/platos").toBeDefined();
    });
  });

  describe("patch", () => {
    it("RED: should call primary PATCH /api/admin/platos/{id} endpoint", async () => {
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos/1": { success: true },
        "/api/admin/menus/dia/dishes/1": { success: true },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.comida.platos.patch(1, { nombre: "Updated" });

      expect(res.success).toBe(true);

      const primaryCall = calls.find((c) => c.url.includes("/api/admin/platos/1") && c.method === "PATCH");
      expect(primaryCall, "Should call primary PATCH /api/admin/platos/1").toBeDefined();
    });
  });

  describe("delete", () => {
    it("RED: should call primary DELETE /api/admin/platos/{id} endpoint", async () => {
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos/1": { success: true },
        "/api/admin/menus/dia/dishes/1": { success: true },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.comida.platos.delete(1);

      expect(res.success).toBe(true);

      const primaryCall = calls.find((c) => c.url.includes("/api/admin/platos/1") && c.method === "DELETE");
      expect(primaryCall, "Should call primary DELETE /api/admin/platos/1").toBeDefined();
    });
  });

  describe("toggle", () => {
    it("RED: should call primary POST /api/admin/platos/{id}/toggle endpoint", async () => {
      const { fetchImpl, calls } = mockFetch({
        "/api/admin/platos/1/toggle": { success: true, active: false },
        "/api/admin/menus/dia/dishes/1": { success: true, active: false },
      });

      const client = createClient({ baseUrl: "", fetchImpl });
      const res = await client.comida.platos.toggle(1);

      expect(res.success).toBe(true);

      const primaryCall = calls.find((c) => c.url.includes("/api/admin/platos/1/toggle") && c.method === "POST");
      expect(primaryCall, "Should call primary POST /api/admin/platos/1/toggle").toBeDefined();
    });
  });
});

describe("comida.bebidas", () => {
  it("calls /api/admin/bebidas GET endpoint", async () => {
    const { fetchImpl, calls } = mockFetch({
      "/api/admin/bebidas": {
        success: true,
        items: [{ num: 1, nombre: "Coca Cola", tipo: "REFRESCO", precio: 3, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false }],
        total: 1,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.bebidas.list({ page: 1, pageSize: 24 });

    expect(res.success).toBe(true);
    const call = calls.find((c) => c.url.includes("/api/admin/bebidas") && c.method === "GET");
    expect(call).toBeDefined();
  });
});

describe("comida.cafes", () => {
  it("calls /api/admin/cafes GET endpoint", async () => {
    const { fetchImpl, calls } = mockFetch({
      "/api/admin/cafes": {
        success: true,
        items: [{ num: 1, nombre: "Espresso", tipo: "CAFE", precio: 2, descripcion: "", titulo: "", suplemento: 0, alergenos: [], active: true, has_foto: false }],
        total: 1,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.cafes.list({ page: 1, pageSize: 24 });

    expect(res.success).toBe(true);
    const call = calls.find((c) => c.url.includes("/api/admin/cafes") && c.method === "GET");
    expect(call).toBeDefined();
  });
});

describe("comida.vinos", () => {
  it("calls /api/admin/vinos GET endpoint", async () => {
    const { fetchImpl, calls } = mockFetch({
      "/api/admin/vinos": {
        success: true,
        vinos: [{ num: 1, nombre: "Rioja Crianza", tipo: "TINTO", precio: 22, descripcion: "", bodega: "Test", denominacion_origen: "Rioja", graduacion: 14, anyo: "2020", active: true, has_foto: false }],
        total: 1,
      },
    });

    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.vinos.list({ page: 1, pageSize: 24 });

    expect(res.success).toBe(true);
    const call = calls.find((c) => c.url.includes("/api/admin/vinos") && c.method === "GET");
    expect(call).toBeDefined();
  });
});
