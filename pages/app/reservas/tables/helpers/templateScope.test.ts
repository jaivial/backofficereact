import { describe, expect, it } from "vitest";

import {
  buildDayOverrideLayout,
  buildGlobalTemplateLayout,
  buildTemplatePayload,
  defaultScope,
  isNonEmptyTemplate,
  stripDayFieldsForTemplate,
  stripTemplateFieldsForDay,
} from "./templateScope";

describe("table map template helpers", () => {
  describe("isNonEmptyTemplate", () => {
    it("returns false for null, undefined, or empty objects", () => {
      expect(isNonEmptyTemplate(null)).toBe(false);
      expect(isNonEmptyTemplate(undefined)).toBe(false);
      expect(isNonEmptyTemplate({})).toBe(false);
    });

    it("returns true when limit_area_template_points has at least one point", () => {
      expect(isNonEmptyTemplate({ limit_area_template_points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] })).toBe(true);
    });

    it("returns true when draw_elements_template has at least one element", () => {
      expect(isNonEmptyTemplate({ draw_elements_template: [{ id: "wall-1" }] })).toBe(true);
    });

    it("returns false when arrays are empty", () => {
      expect(isNonEmptyTemplate({ limit_area_template_points: [] })).toBe(false);
      expect(isNonEmptyTemplate({ draw_elements_template: [] })).toBe(false);
    });
  });

  describe("defaultScope", () => {
    it("returns 'template' when a template is saved and no override is given", () => {
      expect(defaultScope(true)).toBe("template");
    });

    it("returns 'day' when no template is saved", () => {
      expect(defaultScope(false)).toBe("day");
    });

    it("honors an explicit override", () => {
      expect(defaultScope(true, "day")).toBe("day");
      expect(defaultScope(false, "template")).toBe("template");
    });

    it("ignores invalid overrides", () => {
      expect(defaultScope(true, "bogus" as unknown as "day")).toBe("template");
      expect(defaultScope(false, "bogus" as unknown as "day")).toBe("day");
    });
  });

  describe("stripTemplateFieldsForDay", () => {
    it("removes all template-only keys from a per-day layout", () => {
      const next = stripTemplateFieldsForDay({
        booking_states: { "1": { seated: true } },
        limit_area_template_points: [{ x: 0, y: 0 }],
        draw_elements_template: [{ id: "wall-1" }],
        template_updated_at: "2026-04-05T00:00:00Z",
      });
      expect(next).toEqual({ booking_states: { "1": { seated: true } } });
    });

    it("does not mutate the input", () => {
      const original = { booking_states: { x: 1 }, limit_area_template_points: [] };
      stripTemplateFieldsForDay(original);
      expect(original).toHaveProperty("limit_area_template_points");
    });
  });

  describe("stripDayFieldsForTemplate", () => {
    it("removes per-day-only keys from a layout so the rest is safe as a template", () => {
      const next = stripDayFieldsForTemplate({
        booking_states: { "1": { seated: true } },
        table_positions: { "5": { x_pos: 100, y_pos: 200 } },
        _template_scope: "day",
        _limit_area_template_points_override: [{ x: 0, y: 0 }],
        _draw_elements_template_override: [{ id: "wall-1" }],
        limit_area_template_points: [{ x: 0, y: 0 }],
        draw_elements_template: [{ id: "wall-1" }],
      });
      expect(next).toEqual({
        limit_area_template_points: [{ x: 0, y: 0 }],
        draw_elements_template: [{ id: "wall-1" }],
      });
    });
  });

  describe("buildTemplatePayload", () => {
    it("starts from the previous template and overlays the new limit/element data", () => {
      const payload = buildTemplatePayload({
        previousTemplate: { template_updated_at: "2026-01-01T00:00:00Z" },
        limitPoints: [{ x: 1, y: 2 }],
        drawElements: [{ id: "wall-1" }],
      });
      expect(payload).toEqual({
        template_updated_at: "2026-01-01T00:00:00Z",
        limit_area_template_points: [{ x: 1, y: 2 }],
        draw_elements_template: [{ id: "wall-1" }],
      });
    });

    it("returns a fresh object when no previous template is provided", () => {
      const payload = buildTemplatePayload({
        limitPoints: [{ x: 0, y: 0 }],
      });
      expect(payload).toEqual({ limit_area_template_points: [{ x: 0, y: 0 }] });
    });
  });

  describe("buildDayOverrideLayout", () => {
    it("marks the layout as day-specific and copies the template fields as overrides", () => {
      const tpl = {
        limit_area_template_points: [{ x: 0, y: 0 }],
        draw_elements_template: [{ id: "wall-1" }],
      };
      const next = buildDayOverrideLayout(tpl, { booking_states: { "1": { seated: true } } });
      expect(next._template_scope).toBe("day");
      expect(next._limit_area_template_points_override).toEqual([{ x: 0, y: 0 }]);
      expect(next._draw_elements_template_override).toEqual([{ id: "wall-1" }]);
      expect(next.booking_states).toEqual({ "1": { seated: true } });
    });
  });

  describe("buildGlobalTemplateLayout", () => {
    it("strips the day-specific scope and override markers", () => {
      const next = buildGlobalTemplateLayout({
        booking_states: { "1": { seated: true } },
        _template_scope: "day",
        _limit_area_template_points_override: [{ x: 0, y: 0 }],
        _draw_elements_template_override: [{ id: "wall-1" }],
      });
      expect(next).toEqual({ booking_states: { "1": { seated: true } } });
    });
  });
});
