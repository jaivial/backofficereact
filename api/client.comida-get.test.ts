import { describe, expect, it } from "vitest";

import { createClient } from "./client";

function mockFetch(responses: Record<string, unknown>) {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    const key = Object.keys(responses).find((k) => url.includes(k));
    const body = key ? responses[key] : { success: false, message: "not found" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

// Regression: the comida `get()` methods used to fetch the full list
// (limit:500) and filter client-side — downloading up to 500 rows for a
// single item. They must hit the cheap dedicated detail endpoint instead.
describe("comida detail get() uses dedicated endpoint", () => {
  const itemPayload = (num: number) => ({
    success: true,
    item: { num, nombre: "Plato X", tipo: "PRINCIPAL", precio: 9.5 },
    items: [{ num, nombre: "Plato X", tipo: "PRINCIPAL", precio: 9.5 }],
  });

  it("platos.get hits GET /api/admin/comida/platos/{id}", async () => {
    const { fetchImpl, calls } = mockFetch({ "comida/platos/42": itemPayload(42) });
    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.platos.get(42);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/admin/comida/platos/42");
    expect(calls[0].url).not.toContain("limit=500");
  });

  it("bebidas.get hits GET /api/admin/comida/bebidas/{id}", async () => {
    const { fetchImpl, calls } = mockFetch({ "comida/bebidas/7": itemPayload(7) });
    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.bebidas.get(7);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/admin/comida/bebidas/7");
    expect(calls[0].url).not.toContain("limit=500");
  });

  it("vinos.get hits GET /api/admin/comida/vinos/{id}", async () => {
    const { fetchImpl, calls } = mockFetch({
      "comida/vinos/3": { success: true, vino: { num: 3, nombre: "Vino" }, item: { num: 3, nombre: "Vino" } },
    });
    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.vinos.get(3);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/admin/comida/vinos/3");
    expect(calls[0].url).not.toContain("limit=500");
  });

  it("postres.get hits GET /api/admin/comida/postres/{id}", async () => {
    const { fetchImpl, calls } = mockFetch({
      "comida/postres/9": { success: true, postre: { num: 9, descripcion: "Postre" }, item: { num: 9 } },
    });
    const client = createClient({ baseUrl: "", fetchImpl });
    const res = await client.comida.postres.get(9);
    expect(res.success).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/api/admin/comida/postres/9");
    expect(calls[0].url).not.toContain("limit=500");
  });
});
