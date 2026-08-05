import { expect, test } from "../../fixtures/session";

test("debug: layout_updated broadcast carries layout at top level and under data", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async () => {
    const date = new Date().toISOString().slice(0, 10);
    return await new Promise((resolve) => {
      const secure = location.protocol === "https:";
      const socket = new WebSocket(`${secure ? "wss" : "ws"}://${location.host}/api/admin/tables/ws`);
      const timeout = setTimeout(() => resolve({ error: "ws timeout" }), 8000);

      socket.onopen = () => {
        // Simulate closing a drawn area: persist a limit polygon.
        socket.send(JSON.stringify({
          type: "layout_edit",
          date,
          floor_number: 0,
          metadata: {
            elements: [],
            booking_states: {},
            limit_points: [{ x: 50, y: 50 }, { x: 200, y: 50 }, { x: 200, y: 200 }, { x: 50, y: 200 }],
          },
        }));
      };

      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type !== "layout_updated") return;
        clearTimeout(timeout);
        socket.close();
        resolve({
          topLevelLayout: typeof payload.layout === "object" && payload.layout !== null,
          dataLayout: typeof payload.data?.layout === "object" && payload.data?.layout !== null,
          topLevelPoints: Array.isArray(payload.layout?.limit_points) ? payload.layout.limit_points.length : -1,
          dataPoints: Array.isArray(payload.data?.layout?.limit_points) ? payload.data.layout.limit_points.length : -1,
          floor: payload.floor_number,
          date: payload.date,
        });
      };
    });
  });

  console.log("=== WS layout_updated BROADCAST ===");
  console.log(JSON.stringify(result, null, 2));

  expect(result).not.toHaveProperty("error");
  // The fix: layout must be readable from the top level (and ideally data too).
  expect(result.topLevelLayout).toBe(true);
  expect(result.topLevelPoints).toBeGreaterThanOrEqual(3);
  expect(result.dataLayout).toBe(true);
});
