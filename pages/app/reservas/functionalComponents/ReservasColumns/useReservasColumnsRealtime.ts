import { useCallback, useEffect, useRef, useState } from "react";

export type ReservasColumnsWSMessage = {
  type: string;
  restaurant_id?: number;
  user_id?: number;
  columns?: string[];
};

/**
 * Subscribes to the reservations realtime bus and surfaces column-visibility
 * changes made by the same user in another tab/device.
 * Coordination id: reservas_columns_realtime_v1
 */
export function useReservasColumnsRealtime(opts: {
  userId: number | null;
  onColumns: (columns: string[]) => void;
}) {
  const { userId, onColumns } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const onColumnsRef = useRef(onColumns);
  onColumnsRef.current = onColumns;
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    if (typeof window === "undefined" || !userId || wsRef.current) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${proto}//${window.location.host}/api/admin/reservas/ws`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (ev) => {
      try {
        const msg: ReservasColumnsWSMessage = JSON.parse(ev.data);
        // The bus is restaurant-scoped but the preference is personal: only the
        // owner's own tabs may apply the columns.
        if (msg.type !== "reservas_columns" || msg.user_id !== userId) return;
        if (Array.isArray(msg.columns)) onColumnsRef.current(msg.columns);
      } catch {
        // ignore malformed messages
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [userId, connect]);

  return { connected };
}
