/**
 * Optimistic ticket state for writes that were held in the offline queue.
 *
 * While offline the server cannot send back a reloaded ticket, but the waiter
 * still has to see the dish on the comanda they just rang, with the right
 * total, or the till looks broken and they will ring it twice. These pure
 * functions reproduce the server's arithmetic on the current ticket so the
 * panel and the running total stay honest while the queue drains. They are
 * reconciled against the server on reconnect: the flush reloads the ticket and
 * the server's numbers replace these.
 *
 * Money arithmetic stays in integer cents everywhere, matching the backend, so
 * an optimistic total and a replayed total are computed the same way.
 */

import type { Ticket, TicketLine } from "../types/register";

export type POSQueuedLineIntent = {
  path: string;
  body: Record<string, unknown>;
  /** Modifiers as the server will snapshot them, so the offline line matches. */
  modifiers?: TicketLine["modifiers"];
  /** The pack this line came from, so the panel can show it as a pack. */
  packId?: number;
};

/** Negative local ids so an optimistic line can never collide with a real one. */
export function optimisticLineId(ticketId: number, seq: number): number {
  return -(ticketId * 1000 + seq);
}

/**
 * Applies a queued "add line" to the ticket locally. Returns the ticket with the
 * line appended and the totals recomputed, or the ticket unchanged when the
 * entry is not a line add (the caller then just reloads).
 *
 * The line is drawn with everything the queued request carries (modifiers,
 * pack) because the waiter is reading this comanda to decide what to tell the
 * guest. A line that showed "2 x cafe" with no "sin azúcar" would be re-ringed
 * out of fear, and the guest would be charged twice.
 */
export function applyQueuedLine(ticket: Ticket, intent: POSQueuedLineIntent, productName: string, priceGrossCents: number, vatRate: number, seq: number): Ticket {
  const quantity = typeof intent.body.quantity === "number" ? intent.body.quantity : 1;
  const override = typeof intent.body.unitPriceOverrideCents === "number" ? intent.body.unitPriceOverrideCents : null;
  const unitPrice = override ?? priceGrossCents;
  const line: TicketLine = {
    id: optimisticLineId(ticket.id, seq),
    productId: typeof intent.body.productId === "number" ? intent.body.productId : null,
    productName,
    quantity,
    unitPriceGrossCents: unitPrice,
    lineTotalGrossCents: unitPrice * quantity,
    vatRate,
    status: "ACTIVE",
    /** Marks the line as not yet on the server, so the UI can label it. */
    notes: intent.body.notes ? String(intent.body.notes) : undefined,
    modifiers: intent.modifiers?.length ? intent.modifiers : undefined,
    packId: intent.packId ?? null,
  };
  const lines = [...ticket.lines, line];
  return recompute(ticket, lines);
}

/** Applies a queued quantity change to an existing line, locally. */
export function applyQueuedQuantity(ticket: Ticket, lineId: number, quantity: number): Ticket {
  const lines = ticket.lines.map((line) => (line.id === lineId ? { ...line, quantity, lineTotalGrossCents: line.unitPriceGrossCents * quantity } : line));
  return recompute(ticket, lines);
}

/** Applies a queued void to a line, locally. */
export function applyQueuedVoid(ticket: Ticket, lineId: number): Ticket {
  const lines = ticket.lines.map((line) => (line.id === lineId ? { ...line, status: "VOIDED", lineTotalGrossCents: 0 } : line));
  return recompute(ticket, lines);
}

/** Recomputes subtotal and total from the active lines, mirroring the server. */
function recompute(ticket: Ticket, lines: TicketLine[]): Ticket {
  const subtotal = lines.filter((line) => line.status !== "VOIDED").reduce((sum, line) => sum + (line.lineTotalGrossCents || 0), 0);
  return { ...ticket, lines, subtotalGrossCents: subtotal, totalGrossCents: Math.max(0, subtotal + (ticket.surchargeCents || 0) - (ticket.discountCents || 0)) };
}
