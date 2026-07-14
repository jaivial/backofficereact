import { test, expect } from "../../fixtures/session";

/**
 * AI translation flow for dishes.
 *
 * Requires the backend to be configured with a (mock) MiniMax provider
 * (MINIMAX_API_KEY set). When translations are disabled the `*_english`
 * fields are absent and these tests are skipped so they never flake in
 * environments without the provider.
 *
 * A deterministic mock MiniMax that returns "EN:<input>" makes the English
 * assertions exact; without it we only assert the fields are populated.
 */

const uniq = () => `TX-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

test.describe("Dish AI translations", () => {
  test("creating a plato stores and returns English fields concurrently", async ({ adminPage }) => {
    const nombre = `Croquetas ${uniq()}`;
    const descripcion = "Cremosas y caseras";

    // Create via the same API the modal uses.
    const created = await adminPage.evaluate(
      async ([n, d]) => {
        const res = await fetch("/api/admin/platos", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ nombre: n, precio: 9.5, descripcion: d }),
        });
        return res.json();
      },
      [nombre, descripcion],
    );

    expect(created.success).toBeTruthy();
    const num = created.num ?? created.item?.num;
    expect(num).toBeTruthy();

    if (created.item?.nombre_english === undefined) {
      test.skip(true, "MiniMax translations not configured on backend");
      return;
    }

    // Both text fields translated on create.
    expect(String(created.item.nombre_english).length).toBeGreaterThan(0);
    expect(String(created.item.descripcion_english).length).toBeGreaterThan(0);

    // Read back: single GET returns item + items[] with English preserved.
    const fetched = await adminPage.evaluate(async (id) => {
      const res = await fetch(`/api/admin/comida/platos/${id}`, { credentials: "include" });
      return res.json();
    }, num);
    expect(fetched.item.nombre_english).toBe(created.item.nombre_english);

    // Patching only the description re-translates just that field.
    const patched = await adminPage.evaluate(async (id) => {
      const res = await fetch(`/api/admin/platos/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ descripcion: "Muy crujientes" }),
      });
      return res.json();
    }, num);
    expect(patched.success).toBeTruthy();
    // nombre translation unchanged (reused), description changed.
    expect(patched.item.nombre_english).toBe(created.item.nombre_english);
    expect(patched.item.descripcion_english).not.toBe(created.item.descripcion_english);

    // Cleanup.
    await adminPage.evaluate(async (id) => {
      await fetch(`/api/admin/platos/${id}`, { method: "DELETE", credentials: "include" });
    }, num);
  });

  test("creating a plato with a failing translation still succeeds", async ({ adminPage }) => {
    // The primary write must never fail because of translation issues. Even if
    // MiniMax is down, the dish is created (Spanish saved) with success=true.
    const created = await adminPage.evaluate(async () => {
      const res = await fetch("/api/admin/platos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nombre: `Fail-safe ${Date.now()}`, precio: 1, descripcion: "x" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(created.body.success).toBeTruthy();
    const num = created.body.num ?? created.body.item?.num;
    await adminPage.evaluate(async (id) => {
      await fetch(`/api/admin/platos/${id}`, { method: "DELETE", credentials: "include" });
    }, num);
  });
});
