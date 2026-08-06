import { expect, test } from "../../fixtures/session";

test("debug: template saved on one date loads on another date", async ({ adminPage: page }) => {
  await page.goto("/app/pos", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async (): Promise<{
    saved: { ok: boolean; error?: string };
    templateGet: { ok: boolean; hasTemplate: boolean; points: number; elements: number };
    dateB: { layoutHasTemplatePoints: number; layoutHasTemplateElements: number; layoutElements: number; layoutLimitPoints: number };
    dateA: { layoutHasTemplatePoints: number; layoutHasTemplateElements: number; layoutElements: number; layoutLimitPoints: number };
    error?: string;
  }> => {
    const dateA = "2026-08-05";
    const dateB = "2026-08-06";
    const secure = location.protocol === "https:";
    const wsURL = `${secure ? "wss" : "ws"}://${location.host}/api/admin/tables/ws`;
    const template = {
      limit_area_template_points: [
        { x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 250 }, { x: 100, y: 250 },
      ],
      draw_elements_template: [
        { id: "wall-1", kind: "wall", preset: "wall", x: 10, y: 10, width: 120, height: 12, rotationDeg: 0, display_mode: "both" },
      ],
      template_updated_at: "2026-08-05T00:00:00Z",
    };

    // 1. Save the template via the same WS message the UI sends.
    const saved = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const socket = new WebSocket(wsURL);
      const timeout = setTimeout(() => { socket.close(); resolve({ ok: false, error: "ws timeout" }); }, 8000);
      socket.onopen = () => {
        socket.send(JSON.stringify({ type: "template_edit", floor_number: 0, data: template }));
      };
      socket.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type !== "template_updated") return;
        clearTimeout(timeout);
        socket.close();
        resolve({ ok: true });
      };
    });
    if (!saved.ok) {
      return {
        saved,
        error: saved.error,
        templateGet: { ok: false, hasTemplate: false, points: -1, elements: -1 },
        dateB: { layoutHasTemplatePoints: -1, layoutHasTemplateElements: -1, layoutElements: -1, layoutLimitPoints: -1 },
        dateA: { layoutHasTemplatePoints: -1, layoutHasTemplateElements: -1, layoutElements: -1, layoutLimitPoints: -1 },
      };
    }

    // 2. Read the template back.
    const templateGet = await fetch("/api/admin/tables/template/0", { credentials: "include" });
    const templateBody = await templateGet.json();

    // 3. Load date B (no per-day layout) and inspect what the backend returns.
    const listB = await fetch(`/api/admin/tables?date=${dateB}&floor_number=0`, { credentials: "include" });
    const listBBody = await listB.json();
    const mapB = listBBody.layout?.map || listBBody.layout || {};

    // 4. Load date A and inspect as well.
    const listA = await fetch(`/api/admin/tables?date=${dateA}&floor_number=0`, { credentials: "include" });
    const listABody = await listA.json();
    const mapA = listABody.layout?.map || listABody.layout || {};

    return {
      saved,
      templateGet: { ok: templateGet.ok, hasTemplate: Boolean(templateBody.template), points: Array.isArray(templateBody.template?.limit_area_template_points) ? templateBody.template.limit_area_template_points.length : -1, elements: Array.isArray(templateBody.template?.draw_elements_template) ? templateBody.template.draw_elements_template.length : -1 },
      dateB: {
        layoutHasTemplatePoints: Array.isArray(mapB.limit_area_template_points) ? mapB.limit_area_template_points.length : -1,
        layoutHasTemplateElements: Array.isArray(mapB.draw_elements_template) ? mapB.draw_elements_template.length : -1,
        layoutElements: Array.isArray(mapB.elements) ? mapB.elements.length : -1,
        layoutLimitPoints: Array.isArray(mapB.limit_points) ? mapB.limit_points.length : -1,
      },
      dateA: {
        layoutHasTemplatePoints: Array.isArray(mapA.limit_area_template_points) ? mapA.limit_area_template_points.length : -1,
        layoutHasTemplateElements: Array.isArray(mapA.draw_elements_template) ? mapA.draw_elements_template.length : -1,
        layoutElements: Array.isArray(mapA.elements) ? mapA.elements.length : -1,
        layoutLimitPoints: Array.isArray(mapA.limit_points) ? mapA.limit_points.length : -1,
      },
    };
  });

  console.log("=== TEMPLATE SAVE + LOAD ON OTHER DATE ===");
  console.log(JSON.stringify(result, null, 2));

  expect(result.saved.ok).toBe(true);
  expect(result.templateGet.points).toBe(4);
  expect(result.templateGet.elements).toBe(1);
  // The template data must be present in date B's layout response.
  expect(result.dateB.layoutHasTemplatePoints).toBe(4);
  expect(result.dateB.layoutHasTemplateElements).toBe(1);
});
