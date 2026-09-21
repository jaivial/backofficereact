import { useCallback, useState } from "react";

import type { SpecialDateSettings } from "../../../../../api/types";
import { createClient } from "../../../../../api/client";

/**
 * Blank special-date row. Exported so both the activation hook and any
 * caller that needs an "empty" draft share ONE definition (DRY): the
 * shape is dictated by the backend `special_dates` row.
 *
 * Coordination id: special_dates_v1
 */
export function emptySpecialDate(date: string): SpecialDateSettings {
  return {
    date,
    is_active: false,
    title: "",
    description: "",
    prereserva_enabled: false,
    max_per_table_enabled: false,
    max_per_table: null,
    mobility_enabled: false,
    requires_adelanto: false,
    adelanto_payment_methods: [],
    adelanto_unified: false,
    adelanto_unified_amount: null,
    prereserva_starts_on: null,
    prereserva_ends_on: null,
    menus: [],
  };
}

export type SpecialDateActivation = {
  activating: boolean;
  error: string | null;
  activate: () => Promise<void>;
};

/**
 * Turns the selected day into a special-menu day.
 *
 * The write goes through the authenticated `POST /config/special-dates`
 * endpoint, which - on commit - fans a `special_date_changed` event out
 * on the global WebSocket hub (coordination id
 * global_socket_special_date_v1). Every other open backoffice tab is
 * therefore reconciled by the socket, while THIS tab flips its local
 * state optimistically so the operator sees the tabs appear instantly
 * instead of waiting a round-trip.
 *
 * `onOptimistic` receives the activated row before the request is sent;
 * `onRevert` is called with the previous value when the write fails and
 * `onSuccess` after the row is committed, so the caller owns its own
 * state and this hook stays reusable.
 *
 * Coordination id: especial_activate_v1
 */
export function useSpecialDateActivation({
  date,
  current,
  onOptimistic,
  onRevert,
  onSuccess,
}: {
  date: string;
  current: SpecialDateSettings | null;
  onOptimistic: (next: SpecialDateSettings) => void;
  onRevert: (previous: SpecialDateSettings | null) => void;
  onSuccess?: () => void;
}): SpecialDateActivation {
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = useCallback(async () => {
    if (!date || activating) return;
    const previous = current;
    const base = current ?? emptySpecialDate(date);
    const next: SpecialDateSettings = { ...base, date, is_active: true };

    setActivating(true);
    setError(null);
    // Optimistic: swap the view to the tabs immediately. No remount, no
    // navigation - the parent just re-renders with `is_active: true`.
    onOptimistic(next);

    try {
      const api = createClient({ baseUrl: "" });
      const res = await api.config.saveSpecialDate(next);
      if (!res.success) {
        onRevert(previous);
        setError(res.message || "No se pudo activar el menú especial");
        return;
      }
      // The row now exists server-side. Let the caller reconcile any
      // derived collection (the card list) that the socket upsert
      // cannot patch, because it had no entry for this date before.
      onSuccess?.();
    } catch (e: unknown) {
      onRevert(previous);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActivating(false);
    }
  }, [activating, current, date, onOptimistic, onRevert, onSuccess]);

  return { activating, error, activate };
}
