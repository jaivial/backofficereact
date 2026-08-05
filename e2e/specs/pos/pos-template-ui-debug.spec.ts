import { expect, test } from "../../fixtures/session";

test("debug: template renders on another date after navigation", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });

  const dateB = "2026-08-06";
  const url = new URL(page.url());
  const secure = url.protocol === "https:";
  const wsHost = url.host;

  // Ensure date B is open so the map canvas renders (closed days gate the canvas).
  await page.evaluate(async (date) => {
    const response = await fetch("/api/admin/config/day", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date, isOpen: true }),
    });
    return response.json();
  }, dateB);

  // Save a template with a distinctive wall label via the WS (same as UI).
  const templateSaved = await page.evaluate(async ({ wsURL }) => {
    const template = {
      limit_area_template_points: [
        { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }, { x: 100, y: 250 },
      ],
      draw_elements_template: [
        { id: "wall-1", kind: "wall", preset: "wall", x: 10, y: 10, width: 120, height: 12, rotationDeg: 0, display_mode: "both", label: "MURO-TEST" },
      ],
      template_updated_at: "2026-08-05T00:00:00Z",
    };
    return await new Promise<boolean>((resolve) => {
      const socket = new WebSocket(wsURL);
      const timeout = setTimeout(() => { socket.close(); resolve(false); }, 8000);
      socket.onopen = () => socket.send(JSON.stringify({ type: "template_edit", floor_number: 0, data: template }));
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type !== "template_updated") return;
        clearTimeout(timeout);
        socket.close();
        resolve(true);
      };
    });
  }, { wsURL: `${secure ? "wss" : "ws"}://${wsHost}/api/admin/tables/ws` });

  expect(templateSaved).toBe(true);

  // Navigate to another date and check the canvas shows the template's wall.
  await page.goto(`/app/reservas/tables?date=${dateB}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);

  const state = await page.evaluate(() => {
    const text = document.body.innerText || "";
    return {
      hasWallLabel: text.includes("MURO-TEST"),
      bodySnippet: text.replace(/\s+/g, " ").slice(0, 600),
    };
  });

  console.log("=== TEMPLATE RENDER ON OTHER DATE ===");
  console.log(JSON.stringify(state, null, 2));
  expect(state.hasWallLabel).toBe(true);
});
