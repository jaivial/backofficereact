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
    setEntries((current) => (current.length <= 1 ? current : current.filter((entry) => entry.id !== id)));
  }, []);

  /** Autocomplete: whatever is still missing goes into this line's method. */
  const fillRemaining = useCallback((id: string) => {
    setEntries((current) => {
      const entry = current.find((item) => item.id === id);
      if (!entry) return current;
      const left = remainingCents(amountDueCents, current);
      if (left <= 0) return current;
      return current.map((item) => (item.id === id ? { ...item, amount: formatTenderInput(left) } : item));
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

  const labelOf = useCallback((method: POSPaymentMethod) => POS_PAYMENT_METHOD_LABELS[method], []);
  const cashlessOf = useCallback((method: POSPaymentMethod) => isCashlessMethod(method), []);

  return {
    entries, setEntries, updateEntry, addEntry, removeEntry, fillRemaining, clear,
    amountDueCents, paidCents, remaining, changeCents, valid, canConfirm, allocations,
    totalsByMethod, labelOf, cashlessOf,
  };
}
