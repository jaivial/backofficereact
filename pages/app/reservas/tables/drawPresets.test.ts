import { describe, expect, it } from "vitest";

import {
  DRAW_TOOL_PRESETS,
  drawPresetAssetImageUrl,
  drawElementSizeForPreset,
  normalizeDrawElementDisplayMode,
  normalizeDrawElementKind,
  normalizeDrawElementPreset,
} from "./drawPresets";

describe("drawPresets", () => {
  it("normalizes unknown preset values to wall", () => {
    expect(normalizeDrawElementPreset("column")).toBe("column");
    expect(normalizeDrawElementPreset("bad-value")).toBe("wall");
  });

  it("normalizes draw kind values", () => {
    expect(normalizeDrawElementKind("image")).toBe("image");
    expect(normalizeDrawElementKind("weird")).toBe("obstacle");
  });

  it("exposes new obstacle presets for the draw tools", () => {
    expect(DRAW_TOOL_PRESETS).toContain("column");
    expect(DRAW_TOOL_PRESETS).toContain("lamp");
    expect(DRAW_TOOL_PRESETS).toContain("trashcan");
    expect(DRAW_TOOL_PRESETS).toContain("bench");
    expect(DRAW_TOOL_PRESETS).toContain("wall_window");
  });

  it("provides preset sizes", () => {
    expect(drawElementSizeForPreset("wall")).toEqual({ width: 220, height: 26 });
    expect(drawElementSizeForPreset("column")).toEqual({ width: 116, height: 116 });
  });

  it("includes an asset for wall", () => {
    expect(drawPresetAssetImageUrl("wall")).toBe("/assets/draw/wall.png");
  });

  it("normalizes display mode and defaults to both", () => {
    expect(normalizeDrawElementDisplayMode("asset")).toBe("asset");
    expect(normalizeDrawElementDisplayMode("text")).toBe("text");
    expect(normalizeDrawElementDisplayMode("both")).toBe("both");
    expect(normalizeDrawElementDisplayMode("invalid")).toBe("both");
    expect(normalizeDrawElementDisplayMode(undefined)).toBe("both");
  });
});
