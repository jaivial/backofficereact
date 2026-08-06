import { expect, test } from "../../fixtures/session";

test("debug: draw element resize persists after another change", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });
  const date = new Date().toISOString().slice(0, 10);
  const url = new URL(page.url());
  const wsHost = url.host;
  const secure = url.protocol === "https:";
  const wsURL = `${secure ? "wss" : "ws"}://${wsHost}/api/admin/tables/ws`;

  // Open the day and reset the layout for the date.
  await page.evaluate(async (d) => {
    await fetch("/api/admin/config/day", {
      method: "POST", credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ date: d, isOpen: true }),
    });
  }, date);

  // Seed a wall element with known dims in the per-day layout via WS.
  const seeded = await page.evaluate(async ({ wsURL, date }) => {
    return await new Promise<boolean>((resolve) => {
      const socket = new WebSocket(wsURL);
      const timeout = setTimeout(() => { socket.close(); resolve(false); }, 8000);
      socket.onopen = () => socket.send(JSON.stringify({
        type: "layout_edit",
        date,
        floor_number: 0,
        metadata: {
          elements: [{ id: "draw-wall-seed", kind: "wall", preset: "wall", x: 80, y: 80, width: 120, height: 12, rotationDeg: 0, display_mode: "both", label: "WALL-SEED" }],
          booking_states: {},
          limit_points: [],
        },
      }));
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type !== "layout_updated") return;
        clearTimeout(timeout);
        socket.close();
        resolve(true);
      };
    });
  }, { wsURL, date });
  expect(seeded).toBe(true);

  // Load the map page and enter edit mode, then drive a real NodeResizer drag
  // on the wall's resize handle to resize it.
  await page.goto(`/app/reservas/tables?date=${date}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Enter edit mode ("Dibujar" / edit toggle) if not already.
  const editBtn = page.locator('[data-ui="edit-mode-btn"], [data-ui="draw-mode-btn"]').first();
  const hasEditBtn = await editBtn.count();
  if (hasEditBtn > 0) {
    await editBtn.click();
    await page.waitForTimeout(500);
  }

  const wall = page.locator('[data-ui="draw-element"]', { hasText: "WALL-SEED" }).first();
  await expect(wall).toBeVisible({ timeout: 10_000 });

  // Get the resize handle (bottom-right) and drag it to grow the element.
  const handle = wall.locator('.react-flow__resize-control.handle.bottom.right').first();
  await expect(handle).toBeVisible({ timeout: 5000 });
  const box = await wall.boundingBox();
  if (!box) throw new Error("wall has no bounding box");
  const startX = box.x + box.width;
  const startY = box.y + box.height;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 90, startY + 60, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1500);

  // Read the persisted element width from the backend (per-day layout).
  const afterResize = await page.evaluate(async (d) => {
    const response = await fetch(`/api/admin/tables?date=${d}&floor_number=0`, { credentials: "include" });
    const body = await response.json();
    const layout = body.layout?.map || body.layout || {};
    const elements: any[] = Array.isArray(layout.elements) ? layout.elements : [];
    const wallEl = elements.find((e) => e.id === "draw-wall-seed");
    return wallEl ? { width: wallEl.width, height: wallEl.height } : null;
  }, date);

  console.log("=== AFTER RESIZE (persisted) ===");
  console.log(JSON.stringify(afterResize, null, 2));

  expect(afterResize).not.toBeNull();
  expect(afterResize!.width).toBeGreaterThan(120);
  expect(afterResize!.height).toBeGreaterThan(12);

  // Now do another change (drag the element) to confirm the size is NOT lost.
  const wallAfter = page.locator('[data-ui="draw-element"]', { hasText: "WALL-SEED" }).first();
  const boxAfter = await wallAfter.boundingBox();
  if (!boxAfter) throw new Error("wall lost after resize");
  await page.mouse.move(boxAfter.x + 20, boxAfter.y + 20);
  await page.mouse.down();
  await page.mouse.move(boxAfter.x + 60, boxAfter.y + 40, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1500);

  const afterMove = await page.evaluate(async (d) => {
    const response = await fetch(`/api/admin/tables?date=${d}&floor_number=0`, { credentials: "include" });
    const body = await response.json();
    const layout = body.layout?.map || body.layout || {};
    const elements: any[] = Array.isArray(layout.elements) ? layout.elements : [];
    const wallEl = elements.find((e) => e.id === "draw-wall-seed");
    return wallEl ? { width: wallEl.width, height: wallEl.height, x: wallEl.x, y: wallEl.y } : null;
  }, date);

  console.log("=== AFTER MOVE (size must survive) ===");
  console.log(JSON.stringify(afterMove, null, 2));

  expect(afterMove).not.toBeNull();
  expect(afterMove!.width).toBeGreaterThan(120);
  expect(afterMove!.height).toBeGreaterThan(12);
});
