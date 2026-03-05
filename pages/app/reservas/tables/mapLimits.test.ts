import { describe, expect, it } from "vitest";

import {
  findNearestRectInsideLimitArea,
  hasClosedLimitArea,
  isPointInsideLimitArea,
  isRectInsideLimitArea,
  normalizeLimitPoints,
} from "./mapLimits";

const square = [
  { x: 100, y: 100 },
  { x: 400, y: 100 },
  { x: 400, y: 400 },
  { x: 100, y: 400 },
];

const concave = [
  { x: 0, y: 0 },
  { x: 6, y: 0 },
  { x: 6, y: 6 },
  { x: 4, y: 6 },
  { x: 4, y: 2 },
  { x: 2, y: 2 },
  { x: 2, y: 6 },
  { x: 0, y: 6 },
];

describe("mapLimits", () => {
  it("normalizes layout points and ignores malformed entries", () => {
    const normalized = normalizeLimitPoints([{ x: 1, y: 2 }, null, { x: "3", y: 4 }, { x: 9, y: 8 }]);
    expect(normalized).toEqual([
      { x: 1, y: 2 },
      { x: 9, y: 8 },
    ]);
  });

  it("detects closed polygons", () => {
    expect(hasClosedLimitArea(square)).toBe(true);
    expect(hasClosedLimitArea(square.slice(0, 2))).toBe(false);
  });

  it("treats border points as inside", () => {
    expect(isPointInsideLimitArea({ x: 100, y: 250 }, square)).toBe(true);
    expect(isPointInsideLimitArea({ x: 250, y: 250 }, square)).toBe(true);
    expect(isPointInsideLimitArea({ x: 450, y: 250 }, square)).toBe(false);
  });

  it("requires full rectangle body to stay inside", () => {
    expect(isRectInsideLimitArea({ x: 120, y: 120, width: 100, height: 80 }, square)).toBe(true);
    expect(isRectInsideLimitArea({ x: 350, y: 350, width: 80, height: 80 }, square)).toBe(false);
  });

  it("rejects rectangles that cut through concave gaps even when corners are inside", () => {
    expect(isRectInsideLimitArea({ x: 1, y: 1, width: 4, height: 4 }, concave)).toBe(false);
  });

  it("returns null when no fully-inside placement exists", () => {
    const position = findNearestRectInsideLimitArea({ x: 1, y: 1 }, { width: 4, height: 4 }, concave);
    expect(position).toBeNull();
  });

  it("finds a nearby valid rectangle position when preferred is outside", () => {
    const position = findNearestRectInsideLimitArea({ x: 380, y: 380 }, { width: 120, height: 120 }, square);
    expect(position).not.toBeNull();
    expect(isRectInsideLimitArea({ x: position!.x, y: position!.y, width: 120, height: 120 }, square)).toBe(true);
  });
});
