import { describe, it, expect } from "vitest";
import {
  rebalanceByPercentage,
  rebalanceByPeople,
  percentagesToPeople,
  peopleToPercentage,
  sumPercentages,
  equalSplit,
  normalizePercentages,
  clampPercentage,
} from "./rebalance";

const approx = (a: number, b: number) => Math.abs(a - b) <= 0.011;

describe("rebalance lib", () => {
  it("scales siblings when one hour changes", () => {
    const in_ = equalSplit(["13:00", "13:30", "14:00", "14:30", "15:00"]);
    const out = rebalanceByPercentage(in_, "13:00", 40);
    expect(out["13:00"]).toBe(40);
    for (const h of ["13:30", "14:00", "14:30", "15:00"]) {
      expect(approx(out[h], 15)).toBe(true);
    }
    expect(approx(sumPercentages(out), 100)).toBe(true);
  });

  it("forces a single hour to 100", () => {
    const out = rebalanceByPercentage({ "13:00": 0 }, "13:00", 50);
    expect(out["13:00"]).toBe(100);
  });

  it("distributes equally when siblings have zero weight", () => {
    const out = rebalanceByPercentage({ "13:00": 0, "13:30": 0, "14:00": 0 }, "13:00", 40);
    expect(approx(sumPercentages(out), 100)).toBe(true);
    expect(approx(out["13:30"], 30)).toBe(true);
    expect(approx(out["14:00"], 30)).toBe(true);
  });

  it("clamps out-of-range values", () => {
    const out = rebalanceByPercentage({ "13:00": 50, "14:00": 50 }, "13:00", 150);
    expect(out["13:00"]).toBe(100);
    expect(out["14:00"]).toBe(0);
  });

  it("converts people change to percentage then rebalances", () => {
    const out = rebalanceByPeople(
      { "13:00": 20, "13:30": 20, "14:00": 20, "14:30": 20, "15:00": 20 },
      "13:00",
      34,
      100,
    );
    expect(approx(out["13:00"], 34)).toBe(true);
    expect(approx(sumPercentages(out), 100)).toBe(true);
  });

  it("derives people from percentages and back", () => {
    const people = percentagesToPeople({ "13:00": 40, "14:00": 60 }, 100);
    expect(people).toEqual({ "13:00": 40, "14:00": 60 });
    expect(approx(peopleToPercentage(34, 100), 34)).toBe(true);
  });

  it("synthesizes an equal split", () => {
    const out = equalSplit(["13:00", "13:30", "14:00"]);
    expect(approx(sumPercentages(out), 100)).toBe(true);
  });

  it("normalizes stored percentages against active hours", () => {
    const out = normalizePercentages({ "13:00": 50, "13:30": 50 }, ["13:00", "13:30", "14:00"]);
    expect(out["14:00"]).toBe(0);
    expect(out["13:00"]).toBe(50);
  });

  it("clamps raw percentage", () => {
    expect(clampPercentage(-5)).toBe(0);
    expect(clampPercentage(150)).toBe(100);
  });
});
