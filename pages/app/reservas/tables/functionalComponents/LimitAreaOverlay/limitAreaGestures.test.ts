import { describe, expect, it } from "vitest";
import {
  DOUBLE_TAP_MAX_DIST,
  DOUBLE_TAP_MAX_MS,
  DRAG_START_DIST,
  isDoubleTap,
  makeTapRecord,
} from "./limitAreaGestures";

const T0 = 1_000;

describe("limitAreaGestures", () => {
  it("detects a double tap within time and distance", () => {
    const prev = makeTapRecord("segment", 2, 100, 200, T0);
    const next = makeTapRecord("segment", 2, 104, 202, T0 + 250);
    expect(isDoubleTap(prev, next)).toBe(true);
  });

  it("rejects a tap that arrives too late", () => {
    const prev = makeTapRecord("vertex", 0, 100, 200, T0);
    const next = makeTapRecord("vertex", 0, 100, 200, T0 + DOUBLE_TAP_MAX_MS + 1);
    expect(isDoubleTap(prev, next)).toBe(false);
  });

  it("rejects a tap that moved too far", () => {
    const prev = makeTapRecord("segment", 1, 100, 200, T0);
    const next = makeTapRecord("segment", 1, 100 + DOUBLE_TAP_MAX_DIST + 1, 200, T0 + 100);
    expect(isDoubleTap(prev, next)).toBe(false);
  });

  it("rejects taps on different targets", () => {
    const prev = makeTapRecord("vertex", 1, 100, 200, T0);
    const next = makeTapRecord("segment", 1, 100, 200, T0 + 100);
    expect(isDoubleTap(prev, next)).toBe(false);
  });

  it("rejects taps on different indices", () => {
    const prev = makeTapRecord("vertex", 1, 100, 200, T0);
    const next = makeTapRecord("vertex", 2, 100, 200, T0 + 100);
    expect(isDoubleTap(prev, next)).toBe(false);
  });

  it("rejects a null previous tap", () => {
    expect(isDoubleTap(null, makeTapRecord("vertex", 0, 100, 200, T0))).toBe(false);
  });

  it("exposes a drag start distance below the double-tap distance", () => {
    expect(DRAG_START_DIST).toBeLessThan(DOUBLE_TAP_MAX_DIST);
  });
});
