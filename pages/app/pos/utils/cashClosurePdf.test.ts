import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCashClosurePdf, type CashClosureSummary } from "./cashClosurePdf";

const saved: string[] = [];
const texts: string[] = [];
const tableBodies: unknown[][] = [];

vi.mock("jspdf", () => ({
  jsPDF: class {
    lastAutoTable = { finalY: 100 };
    setFont() { return this; }
    setFontSize() { return this; }
    text(value: string) { texts.push(value); return this; }
    save(name: string) { saved.push(name); return this; }
  },
}));
vi.mock("jspdf-autotable", () => ({ default: (doc: { lastAutoTable: { finalY: number } }, options: { body?: unknown[][] }) => { tableBodies.push(options.body || []); doc.lastAutoTable = { finalY: doc.lastAutoTable.finalY + 25 }; } }));

const summary: CashClosureSummary = {
  shiftId: 42, terminalKey: "main", status: "OPEN", openingCashCents: 10000,
  salesGrossCents: 50000, refundsCents: 1000, netSalesCents: 49000, discountsCents: 200,
  surchargesCents: 100, tipsCents: 500, cashSalesCents: 20000, cashTipsCents: 200,
  cardSalesCents: 25000, cardTipsCents: 300, bankSalesCents: 5000, bankTipsCents: 0,
  otherSalesCents: 0, otherTipsCents: 0, cashRefundsCents: 1000, cashInCents: 500,
  cashOutCents: 250, expectedCashCents: 29450, countedCashCents: 29400, differenceCents: -50,
  ticketCount: 12, voidedTicketCount: 1, covers: 27, openVisitCount: 0, openTicketCount: 0,
};

describe("downloadCashClosurePdf", () => {
  beforeEach(() => { saved.length = 0; texts.length = 0; tableBodies.length = 0; });

  it.each(["X", "Y", "Z"] as const)("exports closure %s with the shift filename and discrepancy", async (closureType) => {
    await downloadCashClosurePdf({ closureType, summary });
    expect(saved).toEqual([`cierre-${closureType}-turno-42.pdf`]);
    expect(texts).toContain(`Tickets cobrados: 12 · Anulados: 1 · Comensales: 27`);
    expect(tableBodies[0]).toContainEqual(["Diferencia", "-0,50 €"]);
  });
});
