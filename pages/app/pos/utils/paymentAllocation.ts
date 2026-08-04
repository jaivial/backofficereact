export type PaymentAllocation = { method: "CASH" | "CARD"; amountCents: number; tipCents: number };

const validCents = (value: number) => Number.isSafeInteger(value) && value >= 0;

export function getCheckoutAmounts(saleTotalCents: number, tipCents: number, tenderedCents: number) {
  const amountDueCents = saleTotalCents + tipCents;
  return { saleTotalCents, tipCents, amountDueCents, tenderedCents, changeDueCents: Math.max(tenderedCents - amountDueCents, 0) };
}

export function allocatePayments(input: { saleTotalCents: number; tipCents: number; cashTenderedCents: number; cardTenderedCents: number }): PaymentAllocation[] {
  const { saleTotalCents, tipCents, cashTenderedCents, cardTenderedCents } = input;
  if (![saleTotalCents, tipCents, cashTenderedCents, cardTenderedCents].every(validCents)) throw new Error("Importe no válido.");
  if (cashTenderedCents + cardTenderedCents < saleTotalCents + tipCents) throw new Error("El pago no cubre el total.");

  const cashCollected = Math.min(cashTenderedCents, saleTotalCents + tipCents);
  const cashSale = Math.min(cashCollected, saleTotalCents);
  const cardSale = saleTotalCents - cashSale;
  const cashTip = Math.min(cashCollected - cashSale, tipCents);
  const cardTip = tipCents - cashTip;
  const payments: PaymentAllocation[] = [];
  if (cashSale + cashTip > 0) payments.push({ method: "CASH", amountCents: cashSale, tipCents: cashTip });
  if (cardSale + cardTip > 0) payments.push({ method: "CARD", amountCents: cardSale, tipCents: cardTip });
  return payments;
}
