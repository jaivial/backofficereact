import { describe, expect, it } from "vitest";

import {
  autonomoQuota,
  computeIncomeTax,
  computeIva,
  computeSimulation,
  findGrossBand,
  IVA_DEFAULT,
  type EntityType,
  type TaxAssumptions,
} from "./taxCalc";

const defaultAssumptions: TaxAssumptions = {
  iva: IVA_DEFAULT,
  grossIncludesIva: true,
  otherDeductibleExpenses: 0,
  includeSocialSecurity: true,
  stockPurchases: 30_000,
};

describe("computeIva", () => {
  it("splits gross into base and collected IVA using food/drink mix", () => {
    const gross = 100_000;
    const { base, ivaCollected } = computeIva(gross, IVA_DEFAULT);
    expect(base + ivaCollected).toBeCloseTo(gross);
    expect(ivaCollected).toBeGreaterThan(0);
    expect(base).toBeLessThan(gross);
  });
});

describe("findGrossBand", () => {
  it("returns micro band below 100k", () => {
    expect(findGrossBand(80_000).label).toBe("Micro");
  });
  it("returns grande band above 500k", () => {
    expect(findGrossBand(900_000).label).toBe("Grande");
  });
});

describe("computeIncomeTax", () => {
  it("applies progressive IRPF brackets for autónomo", () => {
    const result = computeIncomeTax(30_000, "autonomo");
    expect(result.taxDue).toBeGreaterThan(0);
    expect(result.slices.length).toBeGreaterThanOrEqual(2);
    expect(result.taxDue).toBeLessThan(30_000);
  });

  it("applies 25% for SL general", () => {
    const result = computeIncomeTax(30_000, "sl");
    expect(result.taxDue).toBeCloseTo(7_500);
    expect(result.slices[0].rate).toBe(0.25);
  });

  it("applies 15% on first 300k for new company in first profit year", () => {
    const result = computeIncomeTax(400_000, "sl_new", true);
    expect(result.taxDue).toBeCloseTo(300_000 * 0.15 + 100_000 * 0.25);
    expect(result.slices.length).toBe(2);
  });

  it("uses general 25% for new company after first profit year", () => {
    const result = computeIncomeTax(400_000, "sl_new", false);
    expect(result.taxDue).toBeCloseTo(100_000);
    expect(result.slices.length).toBe(1);
  });

  it("returns zero tax for negative taxable base", () => {
    const result = computeIncomeTax(-5_000, "autonomo");
    expect(result.taxDue).toBe(0);
    expect(result.taxableBase).toBe(0);
  });

  it("applies micropyme 19/21% for sl_micro (2026)", () => {
    const result = computeIncomeTax(60_000, "sl_micro");
    expect(result.taxDue).toBeCloseTo(50_000 * 0.19 + 10_000 * 0.21);
    expect(result.slices.length).toBe(2);
    expect(result.slices[0].rate).toBe(0.19);
    expect(result.slices[1].rate).toBe(0.21);
  });
});

describe("autonomoQuota (RETA 2026)", () => {
  it("uses tier by net monthly income", () => {
    expect(autonomoQuota(600)).toBe(200);
    expect(autonomoQuota(670)).toBe(220); // boundary: 670 falls into tier 2
    expect(autonomoQuota(1_400)).toBe(294);
    expect(autonomoQuota(4_924)).toBe(530);
    expect(autonomoQuota(7_000)).toBe(590);
  });
});

describe("computeSimulation", () => {
  it("produces net smaller than gross and positive kept rate", () => {
    const result = computeSimulation(200_000, defaultAssumptions, "sl");
    expect(result.net).toBeLessThan(result.gross);
    expect(result.keptRate).toBeGreaterThan(0);
    expect(result.keptRate).toBeLessThan(1);
    expect(result.iva.ivaDue).toBeGreaterThanOrEqual(0);
  });

  it("includes RETA tier-based social security for autónomo when enabled", () => {
    const result = computeSimulation(100_000, defaultAssumptions, "autonomo");
    // taxableBase ≈ 59.091 €/año → 4.924 €/mes → tramo 530 € → 6.360 €/año
    expect(result.socialSecurity).toBeCloseTo(530 * 12);
    expect(result.socialSecurity).toBeGreaterThan(0);
  });

  it("excludes social security for societies", () => {
    const result = computeSimulation(100_000, defaultAssumptions, "sa");
    expect(result.socialSecurity).toBe(0);
  });
});
