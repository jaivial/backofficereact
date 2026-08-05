import { expect, test } from "../../fixtures/session";

test("debug: tables page renders tables after opening the day", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });

  // Open today's day the same way the UI does, then reload the map.
  const today = new Date().toISOString().slice(0, 10);
  const opened = await page.evaluate(async (date) => {
    const response = await fetch("/api/admin/config/day", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, isOpen: true }),
    });
    return { status: response.status, body: await response.json() };
  }, today);
  console.log("=== OPEN DAY ===");
  console.log(JSON.stringify(opened, null, 2));

  await page.goto(`/app/reservas/tables?date=${today}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => {
    const text = document.body.innerText || "";
    const hasMesa1 = text.includes("Mesa 1");
    const hasBarra2 = text.includes("Barra 2");
    const hasTerraza2 = text.includes("Terraza 2");
    return {
      hasTables: hasMesa1 && hasBarra2 && hasTerraza2,
      closedPanel: text.includes("Dia cerrado"),
      bodySnippet: text.replace(/\s+/g, " ").slice(0, 500),
    };
  });

  console.log("=== TABLES PAGE ===");
  console.log(JSON.stringify(state, null, 2));
  expect(state.closedPanel).toBe(false);
  expect(state.hasTables).toBe(true);
});
