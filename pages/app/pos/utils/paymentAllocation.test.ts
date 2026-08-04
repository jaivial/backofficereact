import { describe, expect, it } from "vitest";

import { allocatePayments, getCheckoutAmounts } from "./paymentAllocation";

describe("paymentAllocation", () => {
  it("includes tip in amount due and change without changing sale allocation", () => {
    expect(getCheckoutAmounts(250, 100, 500)).toEqual({ saleTotalCents: 250, tipCents: 100, amountDueCents: 350, tenderedCents: 500, changeDueCents: 150 });
    expect(allocatePayments({ saleTotalCents: 250, tipCents: 100, cashTenderedCents: 500, cardTenderedCents: 0 })).toEqual([
      { method: "CASH", amountCents: 250, tipCents: 100 },
    ]);
  });

  it("allocates mixed sale and tip separately in integer cents", () => {
    expect(allocatePayments({ saleTotalCents: 500, tipCents: 100, cashTenderedCents: 200, cardTenderedCents: 400 })).toEqual([
      { method: "CASH", amountCents: 200, tipCents: 0 },
      { method: "CARD", amountCents: 300, tipCents: 100 },
    ]);
  });

  it("rejects insufficient and invalid tenders", () => {
    expect(() => allocatePayments({ saleTotalCents: 250, tipCents: 100, cashTenderedCents: 349, cardTenderedCents: 0 })).toThrow("El pago no cubre el total.");
    expect(() => allocatePayments({ saleTotalCents: -1, tipCents: 0, cashTenderedCents: 0, cardTenderedCents: 0 })).toThrow("Importe no válido.");
  });
});
