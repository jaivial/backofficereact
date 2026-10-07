/** Coordination id: pos_checkout_payment_methods_v1 - backoffice POS checkout modal <-> pos_payments.method ENUM. */

/** Tenders the checkout modal can split a ticket across, in display order. */
export const POS_PAYMENT_METHODS = ["CASH", "CARD", "BIZUM", "BANK"] as const;

export type POSPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const POS_PAYMENT_METHOD_LABELS: Record<POSPaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  BIZUM: "Bizum",
  BANK: "Transferencia",
};

/** Methods whose money never touches the drawer, so they cannot produce change. */
const CASHLESS_METHODS: readonly POSPaymentMethod[] = ["CARD", "BIZUM", "BANK"];

export function isCashlessMethod(method: POSPaymentMethod): boolean {
  return CASHLESS_METHODS.includes(method);
}

/** One nested split line inside the checkout modal: a method plus a typed amount. */
export type TenderEntry = { id: string; method: POSPaymentMethod; amount: string };

/** Tender accepted by `POST /admin/pos/tickets/{id}/checkout`. */
export type POSPaymentTender = { method: POSPaymentMethod; amountCents: number; tipCents: number };

/** Amount typed into a split line, in cents; -1 while it is not a valid amount. */
export function tenderedCentsOf(value: string): number {
  const parsed = Number.parseFloat(String(value).trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return -1;
  return Math.round(parsed * 100);
}

/**
 * Whether a split line holds anything. A blank or zero line is unused rather
 * than invalid: the checkout dialog opens with a spare CASH and CARD row for
 * the common split, and those rows are not an error until they are filled in.
 */
export function isTenderUsed(entry: TenderEntry): boolean {
  return String(entry.amount).trim() !== "" && tenderedCentsOf(entry.amount) > 0;
}

export function formatTenderInput(cents: number): string {
  return (Math.max(cents, 0) / 100).toFixed(2);
}

export function newTenderEntry(method: POSPaymentMethod): TenderEntry {
  return { id: `${method}-${Math.random().toString(36).slice(2, 9)}`, method, amount: "" };
}

export function entriesTotalCents(entries: TenderEntry[]): number {
  return entries.reduce((total, entry) => total + Math.max(tenderedCentsOf(entry.amount), 0), 0);
}

/** What is still missing to reach the total with what every line holds so far. */
export function remainingCents(amountDueCents: number, entries: TenderEntry[]): number {
  return Math.max(amountDueCents - entriesTotalCents(entries), 0);
}

/**
 * Splits the sale and the tip across the tendered lines, cash last so it soaks
 * the rounding remainder and keeps whatever change the cashless methods cannot
 * return. Throws when a line is invalid or the lines do not reach the total.
 */
export function allocateTenders(input: { saleTotalCents: number; tipCents: number; entries: TenderEntry[] }): POSPaymentTender[] {
  const { saleTotalCents, tipCents } = input;
  const perMethod = new Map<POSPaymentMethod, number>();
  for (const entry of input.entries) {
    const cents = tenderedCentsOf(entry.amount);
    if (cents < 0) throw new Error("Importe no válido.");
    perMethod.set(entry.method, (perMethod.get(entry.method) ?? 0) + cents);
  }
  if (![saleTotalCents, tipCents, ...perMethod.values()].every((value) => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Importe no válido.");
  }
  const amountDueCents = saleTotalCents + tipCents;
  const entered = [...perMethod.values()].reduce((total, value) => total + value, 0);
  if (entered < amountDueCents) throw new Error("El pago no cubre el total.");

  const cashlessTotal = [...perMethod.entries()].filter(([method]) => isCashlessMethod(method)).reduce((total, [, value]) => total + value, 0);
  const cashApplied = Math.max(amountDueCents - cashlessTotal, 0);

  let saleLeft = saleTotalCents;
  let tipLeft = tipCents;
  const payments: POSPaymentTender[] = [];
  for (const method of POS_PAYMENT_METHODS) {
    const tendered = method === "CASH" ? Math.max(perMethod.get("CASH") ?? 0, cashApplied) : Math.min(perMethod.get(method) ?? 0, saleLeft + tipLeft);
    let sale = Math.min(tendered, saleLeft);
    let tip = Math.min(tendered - sale, tipLeft);
    saleLeft -= sale;
    tipLeft -= tip;
    // The backend rejects 0-cent payments, so a tip alone on a method rides on
    // one cent of sale taken from the previous method.
    if (sale === 0 && tip > 0 && payments.length > 0 && payments[payments.length - 1].amountCents > 0) {
      payments[payments.length - 1].amountCents -= 1;
      // The cent moves straight from the previous method into this one, so the
      // running leftovers stay untouched.
      sale = 1;
    }
    if (sale + tip > 0) payments.push({ method, amountCents: sale, tipCents: tip });
  }
  return payments;
}

/** Change the drawer owes back, which only cash can absorb. */
export function cashChangeDueCents(input: { amountDueCents: number; entries: TenderEntry[] }): number {
  const cashEntered = input.entries.filter((entry) => entry.method === "CASH").reduce((total, entry) => total + Math.max(tenderedCentsOf(entry.amount), 0), 0);
  const cashlessTotal = input.entries.filter((entry) => isCashlessMethod(entry.method)).reduce((total, entry) => total + Math.max(tenderedCentsOf(entry.amount), 0), 0);
  const cashApplied = Math.min(Math.max(input.amountDueCents - cashlessTotal, 0), cashEntered);
  return Math.max(cashEntered - cashApplied, 0);
}
