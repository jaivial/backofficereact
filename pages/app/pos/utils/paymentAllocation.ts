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
  let cashSale = Math.min(cashCollected, saleTotalCents);
  let cardSale = saleTotalCents - cashSale;
  let cashTip = Math.min(cashCollected - cashSale, tipCents);
  let cardTip = tipCents - cashTip;
  // The backend rejects 0-cent payments, so a card-paid tip must ride on at
  // least one cent of sale: shift it from cash while keeping the total exact.
  if (cardSale === 0 && cardTip > 0 && cashSale > 0) {
    cardSale = 1;
    cashSale -= 1;
    cashTip = Math.min(cashCollected - cashSale, tipCents);
    cardTip = tipCents - cashTip;
  }
  const payments: PaymentAllocation[] = [];
  if (cashSale + cashTip > 0) payments.push({ method: "CASH", amountCents: cashSale, tipCents: cashTip });
  if (cardSale + cardTip > 0) payments.push({ method: "CARD", amountCents: cardSale, tipCents: cardTip });
  return payments;
}
