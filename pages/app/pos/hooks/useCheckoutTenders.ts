import { useCallback, useMemo, useState } from "react";

import {
  allocateTenders, cashChangeDueCents, entriesTotalCents, formatTenderInput, isCashlessMethod,
  newTenderEntry, remainingCents, tenderedCentsOf,
  POS_PAYMENT_METHOD_LABELS,
  type POSPaymentMethod, type POSPaymentTender, type TenderEntry,
} from "../utils/paymentMethods";

/**
 * State of the checkout split: one nested line per payment method, each with its
 * own amount, plus the "fill the rest" autocomplete every line offers. Keeps the
 * legacy cash/card behaviour (two lines seeded, cash first) so a single tender
 * stays one tap away.
 */
export function useCheckoutTenders(params: { saleTotalCents: number; tipCents: number }) {
  const { saleTotalCents, tipCents } = params;
  const [entries, setEntries] = useState<TenderEntry[]>(() => [newTenderEntry("CASH"), newTenderEntry("CARD")]);

  const amountDueCents = saleTotalCents + tipCents;
  const paidCents = useMemo(() => entriesTotalCents(entries), [entries]);
  const remaining = useMemo(() => remainingCents(amountDueCents, entries), [amountDueCents, entries]);
  const changeCents = useMemo(() => cashChangeDueCents({ amountDueCents, entries }), [amountDueCents, entries]);
  /** Money handed over beyond the total; only cash can take it back as change. */
  const overCents = useMemo(() => Math.max(paidCents - amountDueCents, 0), [amountDueCents, paidCents]);
  /**
   * Whether the over-tender can actually be returned. Cash soaks it as change;
   * an excess sitting only on card, Bizum or bank transfer cannot come back, so
   * the split stays unconfirmable until it is corrected.
   */
  const changeResolved = useMemo(() => cashChangeDueCents({ amountDueCents, entries }) >= overCents, [amountDueCents, entries, overCents]);
  const valid = useMemo(() => entries.every((entry) => tenderedCentsOf(entry.amount) >= 0), [entries]);
  const canConfirm = valid && paidCents >= amountDueCents;

  const allocations = useMemo(() => {
    if (!canConfirm) return [] as POSPaymentTender[];
    try {
      return allocateTenders({ saleTotalCents, tipCents, entries });
    } catch {
      return [] as POSPaymentTender[];
    }
  }, [amountDueCents, canConfirm, entries, saleTotalCents, tipCents]);

  const updateEntry = useCallback((id: string, patch: Partial<Omit<TenderEntry, "id">>) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  }, []);

  const addEntry = useCallback((method: POSPaymentMethod) => {
    setEntries((current) => [...current, newTenderEntry(method)]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    // Invariant: at least one split line always survives. The quick-amount
    // buttons and the cash keypad target the first line and assume it exists.
    setEntries((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== id)));
  }, []);

  /**
   * Autocomplete: this line ends up covering everything the other lines leave
   * open, so the value it writes is exactly what its button label promises.
   */
  const fillRemaining = useCallback((id: string) => {
    setEntries((current) => {
      const entry = current.find((item) => item.id === id);
      if (!entry) return current;
      const target = remainingCents(amountDueCents, current.filter((item) => item.id !== id));
      if (target <= 0) return current;
      return current.map((item) => (item.id === id ? { ...item, amount: formatTenderInput(target) } : item));
    });
  }, [amountDueCents]);

  const clear = useCallback(() => setEntries([newTenderEntry("CASH"), newTenderEntry("CARD")]), []);

  const totalsByMethod = useMemo(() => {
    const totals = new Map<POSPaymentMethod, number>();
    for (const entry of entries) {
      const cents = Math.max(tenderedCentsOf(entry.amount), 0);
      if (cents <= 0) continue;
      totals.set(entry.method, (totals.get(entry.method) ?? 0) + cents);
    }
    return totals;
  }, [entries]);

  /** What a line would hold after "Completar": everything but its own amount. */
  const fillTargetFor = useCallback((id: string) => remainingCents(amountDueCents, entries.filter((entry) => entry.id !== id)), [amountDueCents, entries]);

  const labelOf = useCallback((method: POSPaymentMethod) => POS_PAYMENT_METHOD_LABELS[method], []);
  const cashlessOf = useCallback((method: POSPaymentMethod) => isCashlessMethod(method), []);

  return {
    entries, setEntries, updateEntry, addEntry, removeEntry, fillRemaining, fillTargetFor, clear,
    amountDueCents, paidCents, remaining, changeCents, overCents, changeResolved, valid, canConfirm, allocations,
    totalsByMethod, labelOf, cashlessOf,
  };
}
