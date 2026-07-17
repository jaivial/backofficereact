import { describe, expect, it } from "vitest";
import { deriveSliderPreview } from "./MenuSliderPanel";

const defaults = [
  { id: 1, image_url: "https://cdn.test/default.webp", position: 0, is_default: true, created_at: "" },
];
const custom = [
  { id: 2, image_url: "https://cdn.test/custom.webp", position: 1, is_default: false, created_at: "" },
];

describe("deriveSliderPreview", () => {
  it("shows every custom upload in custom and both modes", () => {
    expect(deriveSliderPreview({ show_slider: true, mode: "custom", ai_enabled: false, images: [...defaults, ...custom] }))
      .toEqual({ mode: "custom", images: ["https://cdn.test/custom.webp"] });
    expect(deriveSliderPreview({ show_slider: true, mode: "both", ai_enabled: false, images: [...defaults, ...custom] }))
      .toEqual({ mode: "both", images: ["https://cdn.test/default.webp", "https://cdn.test/custom.webp"] });
  });

  it("does not expose custom uploads in default or hidden modes", () => {
    expect(deriveSliderPreview({ show_slider: true, mode: "default", ai_enabled: false, images: [...defaults, ...custom] }).images)
      .toEqual(["https://cdn.test/default.webp"]);
    expect(deriveSliderPreview({ show_slider: false, mode: "hidden", ai_enabled: false, images: [...defaults, ...custom] }).images)
      .toEqual([]);
  });
});
