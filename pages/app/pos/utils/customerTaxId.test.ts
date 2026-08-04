import { describe, expect, it } from "vitest";

import { isValidCustomerTaxId, normalizeCustomerTaxId } from "./customerTaxId";

describe("customerTaxId", () => {
  it("normalizes whitespace, separators and case", () => {
    expect(normalizeCustomerTaxId(" b-99286320 ")).toBe("B99286320");
  });

  it("allows blank and validates Spanish NIF, NIE and CIF", () => {
    expect(isValidCustomerTaxId("")).toBe(true);
    expect(isValidCustomerTaxId("12345678Z")).toBe(true);
    expect(isValidCustomerTaxId("X1234567L")).toBe(true);
    expect(isValidCustomerTaxId("B99286320")).toBe(true);
  });

  it("rejects invalid control characters", () => {
    expect(isValidCustomerTaxId("12345678A")).toBe(false);
    expect(isValidCustomerTaxId("B99286321")).toBe(false);
  });
});
