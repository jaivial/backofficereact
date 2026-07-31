import { describe, it, expect } from "vitest";
import {
  DEFAULT_BOUNDARIES,
  boundariesToBands,
  bandsToBoundaries,
} from "./marginBands";

describe("boundariesToBands", () => {
  it("produces the four default zones from [25,35,40]", () => {
    const bands = boundariesToBands([25, 35, 40]);
    expect(bands).toEqual([
      { zone: "PURPLE", min: null, max: 25 },
      { zone: "GREEN", min: 25, max: 35 },
      { zone: "AMBER", min: 35, max: 40 },
      { zone: "RED", min: 40, max: null },
    ]);
  });

  it("rejects non-increasing boundaries", () => {
    expect(() => boundariesToBands([30, 30, 40])).toThrow();
    expect(() => boundariesToBands([40, 35, 30])).toThrow();
    expect(() => boundariesToBands([25, 40, 35])).toThrow();
  });

  it("rejects out-of-range boundaries", () => {
    expect(() => boundariesToBands([0, 35, 40])).toThrow();
    expect(() => boundariesToBands([25, 35, 100])).toThrow();
    expect(() => boundariesToBands([25, 35, 150])).toThrow();
  });

  it("rejects the wrong number of boundaries", () => {
    expect(() => boundariesToBands([25, 35])).toThrow();
    expect(() => boundariesToBands([25, 35, 40, 50])).toThrow();
  });
});

describe("bandsToBoundaries", () => {
  it("round-trips defaults", () => {
    const bands = boundariesToBands(DEFAULT_BOUNDARIES);
    expect(bandsToBoundaries(bands)).toEqual([...DEFAULT_BOUNDARIES]);
  });

  it("falls back to defaults when bands are incomplete", () => {
    expect(bandsToBoundaries([{ zone: "GREEN", min: 20, max: 30 }])).toEqual(
      [...DEFAULT_BOUNDARIES],
    );
  });
});
