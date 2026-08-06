import { expect, test } from "../../fixtures/session";

test("debug: verify table map nesting and create behavior", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const list = await fetch("/api/admin/tables", { credentials: "include" });
    const listBody = await list.json();

    // Duplicate name should now return 409 with a clear message.
    const dup = await fetch("/api/admin/tables", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "table", name: "Mesa 1", capacity: 4, area_id: 1 }),
    });
    const dupBody = await dup.json();

    // Fresh name should succeed.
    const fresh = await fetch("/api/admin/tables", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ entity: "table", name: "Mesa 77", capacity: 4, area_id: 1 }),
    });
    const freshBody = await fresh.json();

    return {
      listStatus: list.status,
      areaCount: (listBody.areas || []).length,
      areaTables: (listBody.areas || []).map((a: any) => ({ name: a.name, tables: (a.tables || []).map((t: any) => t.name) })),
      dupStatus: dup.status,
      dupBody,
      freshStatus: fresh.status,
      freshBody,
    };
  });

  console.log("=== TABLES LIST (areas with nested tables) ===");
  console.log(JSON.stringify({ status: result.listStatus, areaCount: result.areaCount, areaTables: result.areaTables }, null, 2));
  console.log("=== CREATE Mesa 1 (duplicate) ===");
  console.log(JSON.stringify({ status: result.dupStatus, body: result.dupBody }, null, 2));
  console.log("=== CREATE Mesa 77 (fresh) ===");
  console.log(JSON.stringify({ status: result.freshStatus, body: result.freshBody }, null, 2));

  expect(result.listStatus).toBe(200);
});
