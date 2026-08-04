import { expect, test } from "../../fixtures/session";
import type { Page } from "@playwright/test";

// These run against the real deployed backend through an authenticated admin
// session, so a schema drift, a missing route or a permission mistake fails
// here rather than in production.

const API = "/api/admin/comida/technical-sheets";

// Requests go through the page so they carry the real session cookie, exactly
// like the browser does.
async function api<T>(
  page: Page,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  return page.evaluate(
    async ({ method, path, body }) => {
      const response = await fetch(path, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    },
    { method, path, body },
  ) as Promise<{ status: number; body: T }>;
}

test.describe("Technical sheets against the real backend", () => {
  test("creates a sheet, adds steps, duplicates it and cleans up", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });

    const created = await api<{ sheetId: number; outputItemId: number }>(
      adminPage, "POST", API, { name: `E2E ficha ${Date.now()}`, portions: 4 },
    );
    expect(created.status).toBe(200);
    expect(created.body.sheetId).toBeGreaterThan(0);
    // A sheet without an output item could never be produced or deducted.
    expect(created.body.outputItemId).toBeGreaterThan(0);
    const sheetId = created.body.sheetId;

    // Publishing an empty sheet would put a costless, allergen-free dish on the
    // menu, so it must be refused and the sheet must stay a draft.
    const publish = await api(adminPage, "POST", `${API}/${sheetId}/publish`);
    expect(publish.status).toBe(400);
    const afterPublish = await api<{ sheet: { status: string } }>(adminPage, "GET", `${API}/${sheetId}`);
    expect(afterPublish.body.sheet.status).toBe("DRAFT");

    // Steps are numbered contiguously; deleting the middle one closes the gap.
    const stepIds: number[] = [];
    for (const description of ["Uno", "Dos", "Tres"]) {
      const step = await api<{ stepId: number }>(
        adminPage, "POST", `${API}/${sheetId}/steps`, { description },
      );
      expect(step.status).toBe(200);
      stepIds.push(step.body.stepId);
    }
    await api(adminPage, "DELETE", `${API}/${sheetId}/steps/${stepIds[1]}`);
    const steps = await api<{ steps: { stepNo: number; description: string }[] }>(
      adminPage, "GET", `${API}/${sheetId}/steps`,
    );
    expect(steps.body.steps.map((s) => s.stepNo)).toEqual([1, 2]);
    expect(steps.body.steps[1].description).toBe("Tres");

    // An ingredient-less sheet costs nothing and, having no selling price, has
    // no margin zone to report.
    const cost = await api<{ cost: { ingredientCost: number; missingPrices: string[]; zone?: string } }>(
      adminPage, "GET", `${API}/${sheetId}/cost`,
    );
    expect(cost.body.cost.ingredientCost).toBe(0);
    expect(cost.body.cost.missingPrices).toEqual([]);
    expect(cost.body.cost.zone ?? "").toBe("");

    // A duplicate is an independent draft with its own output item.
    const duplicate = await api<{ sheetId: number; outputItemId: number }>(
      adminPage, "POST", `${API}/${sheetId}/duplicate`, {},
    );
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.sheetId).not.toBe(sheetId);
    expect(duplicate.body.outputItemId).not.toBe(created.body.outputItemId);
    const copyStatus = await api<{ sheet: { status: string } }>(
      adminPage, "GET", `${API}/${duplicate.body.sheetId}`,
    );
    expect(copyStatus.body.sheet.status).toBe("DRAFT");

    // Nothing uses these sheets, so both must delete cleanly.
    expect((await api(adminPage, "DELETE", `${API}/${duplicate.body.sheetId}`)).status).toBe(200);
    expect((await api(adminPage, "DELETE", `${API}/${sheetId}`)).status).toBe(200);
  });

  test("rejects an ingredient whose unit belongs to another item", async ({ adminPage }) => {
    await adminPage.goto("/app/stock", { waitUntil: "domcontentloaded" });

    const created = await api<{ sheetId: number; outputItemId: number }>(
      adminPage, "POST", API, { name: `E2E unidad ${Date.now()}` },
    );
    const sheetId = created.body.sheetId;

    // Unit 999999 cannot belong to this item, so the conversion would be wrong.
    const bad = await api(adminPage, "POST", `${API}/${sheetId}/components`, {
      stockItemId: created.body.outputItemId, unitId: 999999, quantity: 10,
    });
    expect(bad.status).toBe(400);

    const components = await api<{ components: unknown[] }>(
      adminPage, "GET", `${API}/${sheetId}/components`,
    );
    expect(components.body.components).toEqual([]);

    await api(adminPage, "DELETE", `${API}/${sheetId}`);
  });
});
