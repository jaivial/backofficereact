import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "../../../../api/client";
import type { POSCashDay, POSCashDayTotals } from "../../../../api/types";

/** Strict YYYY-MM-DD, so a hand-edited URL can never reach the API as a filter. */
export function isValidPOSDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export type POSCashDayState = {
  /** Business date in play. Null until the backend resolves it. */
  date: string | null;
  cashDay: POSCashDay | null;
  unclosedPrevious: POSCashDay[];
  totals: POSCashDayTotals | null;
  loading: boolean;
  error: string;
  readOnly: boolean;
  openDay(params?: { openingCashCents?: number; force?: boolean; notes?: string }): Promise<boolean>;
  closeDay(params: { countedCashCents: number; notes?: string; discrepancyReason?: string }): Promise<boolean>;
  refresh(): Promise<void>;
};

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

function totalsOf(day: POSCashDay | null): POSCashDayTotals | null {
  if (!day) return null;
  return { date: day.date, totalGrossCents: day.totalGrossCents, ticketCount: day.ticketCount, covers: day.covers };
}

/**
 * Cash day state for a business date, kept live over the tables socket.
 *
 * `requestedDate` may be null: the cutoff means the business date is not always
 * today's calendar date, and the backend already resolves that. Asking it
 * instead of recomputing the rule here keeps the two from drifting apart at
 * 02:00, which is exactly when nobody is watching.
 */
export function usePOSCashDay(requestedDate: string | null): POSCashDayState {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [date, setDate] = useState<string | null>(isValidPOSDate(requestedDate) ? requestedDate : null);
  const [cashDay, setCashDay] = useState<POSCashDay | null>(null);
  const [unclosedPrevious, setUnclosedPrevious] = useState<POSCashDay[]>([]);
  const [totals, setTotals] = useState<POSCashDayTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The socket handler must read the date that is current when the message
  // arrives, not the one captured when the socket was opened.
  const dateRef = useRef<string | null>(date);
  dateRef.current = date;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.pos.cashDays.current(isValidPOSDate(requestedDate) ? { date: requestedDate } : undefined);
      if (!response.success) {
        setError(response.message || "No se pudo cargar el día de caja");
        return;
      }
      setError("");
      setDate(response.date);
      setCashDay(response.cashDay);
      setTotals(totalsOf(response.cashDay));
      setUnclosedPrevious(response.unclosedPrevious || []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cargar el día de caja");
    } finally {
      setLoading(false);
    }
  }, [api, requestedDate]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let socket: WebSocket | null = null;
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const secure = window.location.protocol === "https:";
      socket = new WebSocket(`${secure ? "wss" : "ws"}://${window.location.host}/api/admin/tables/ws`);
      socket.onopen = () => { retry = 0; };
      socket.onmessage = (event) => {
        let payload: { type?: string; data?: Record<string, unknown> };
        try { payload = JSON.parse(event.data); } catch { return; }
        const active = dateRef.current;
        if (payload.type === "pos_cash_day_opened" || payload.type === "pos_cash_day_closed") {
          const day = payload.data?.cashDay as POSCashDay | undefined;
          if (!day || day.date !== active) return;
          setCashDay(day);
          setTotals(totalsOf(day));
          // A day that just closed stops being a pending one, and a day that
          // just opened was never pending for its own date.
          setUnclosedPrevious((current) => current.filter((entry) => entry.date !== day.date));
          return;
        }
        if (payload.type === "pos_cash_day_totals") {
          const next = payload.data as unknown as POSCashDayTotals | undefined;
          if (!next || next.date !== active) return;
          setTotals(next);
          setCashDay((current) => (current ? { ...current, totalGrossCents: next.totalGrossCents, ticketCount: next.ticketCount, covers: next.covers } : current));
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        // Exponential backoff: a backend that is down must not be hammered by
        // every open till in the restaurant at once.
        const delay = Math.min(RECONNECT_BASE_MS * 2 ** retry, RECONNECT_MAX_MS);
        retry += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
      socket.onerror = () => { socket?.close(); };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, []);

  const openDay = useCallback(async (params?: { openingCashCents?: number; force?: boolean; notes?: string }) => {
    try {
      const response = await api.pos.cashDays.open({ date: date || undefined, openingCashCents: params?.openingCashCents ?? 0, force: params?.force, notes: params?.notes });
      if (!response.success) { setError(response.message || "No se pudo abrir la caja"); return false; }
      setError("");
      setCashDay(response.cashDay);
      setTotals(totalsOf(response.cashDay));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo abrir la caja");
      return false;
    }
  }, [api, date]);

  const closeDay = useCallback(async (params: { countedCashCents: number; notes?: string; discrepancyReason?: string }) => {
    if (!cashDay) return false;
    try {
      const response = await api.pos.cashDays.close({ id: cashDay.id, ...params });
      if (!response.success) { setError(response.message || "No se pudo cerrar la caja"); return false; }
      setError("");
      setCashDay(response.cashDay);
      setTotals(totalsOf(response.cashDay));
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo cerrar la caja");
      return false;
    }
  }, [api, cashDay]);

  return { date, cashDay, unclosedPrevious, totals, loading, error, readOnly: cashDay?.status === "CLOSED", openDay, closeDay, refresh };
}
