import { describe, expect, it } from "vitest";

import { splitShares } from "./splitShares";

describe("splitShares", () => {
  it("divides an exact total evenly", () => {
    expect(splitShares(3000, 3)).toEqual([1000, 1000, 1000]);
  });

  it("spreads the remainder one cent at a time over the first shares", () => {
    expect(splitShares(1000, 3)).toEqual([334, 333, 333]);
  });

  it("returns the whole total for a single share", () => {
    expect(splitShares(1000, 1)).toEqual([1000]);
  });

  it("returns no shares for a non-positive guest count", () => {
    expect(splitShares(1000, 0)).toEqual([]);
    expect(splitShares(1000, -2)).toEqual([]);
  });

  it("always sums back to the total", () => {
    for (const guests of [2, 3, 4, 6, 7]) {
      expect(splitShares(1999, guests).reduce((sum, share) => sum + share, 0)).toBe(1999);
    }
  });
});
