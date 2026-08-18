import { describe, expect, it } from "vitest";

import {
  formatTableLimit,
  normalizeTableLimit,
  stepTableLimit,
  tableLimitValues,
} from "./configHelpers";

describe("tableLimitValues / normalizeTableLimit (rango 0-99 + Sin límite)", () => {
  it("incluye valores numéricos 0 a 99 y 999 (Sin límite)", () => {
    expect(tableLimitValues).toHaveLength(101);
    expect(tableLimitValues[0]).toBe("0");
    expect(tableLimitValues[99]).toBe("99");
    expect(tableLimitValues[100]).toBe("999");
  });

  it("normaliza valores dentro de 0-99 sin recortar a 40", () => {
    expect(normalizeTableLimit("41")).toBe("41");
    expect(normalizeTableLimit("60")).toBe("60");
    expect(normalizeTableLimit("99")).toBe("99");
    expect(normalizeTableLimit("150")).toBe("99");
  });

  it("mantiene 999 como Sin límite", () => {
    expect(normalizeTableLimit("999")).toBe("999");
    expect(formatTableLimit("999")).toBe("Sin límite");
    expect(formatTableLimit("41")).toBe("41");
  });

  it("avanza paso a paso más allá de 40 hasta 99 y luego a Sin límite", () => {
    expect(stepTableLimit("40", 1)).toBe("41");
    expect(stepTableLimit("99", 1)).toBe("999");
    expect(stepTableLimit("999", 1)).toBe("999");
    expect(stepTableLimit("0", -1)).toBe("0");
  });
});
