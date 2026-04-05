import { useCallback, useEffect, useRef, useState } from "react";

export type ComidaAIWSMessage = {
  type: string;
  restaurant_id?: number;
  tipo?: string;
  item_id?: number;
  foto_url?: string;
  message?: string;
};

export function useComidaAIWebSocket(opts: {
  itemNum: number | null;
  onEvent?: (msg: ComidaAIWSMessage) => void;
}) {
  const { itemNum, onEvent } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:3001";
    const url = `${proto}//${host}/api/admin/comida/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onmessage = (ev) => {
      try {
        const msg: ComidaAIWSMessage = JSON.parse(ev.data);
        // Only emit events for the specific item we're tracking
        if (msg.item_id === itemNum) {
          onEventRef.current?.(msg);
        }
      } catch {
        // ignore malformed messages
      }
    };
  }, [itemNum]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!itemNum) return;
    connect();
    return () => disconnect();
  }, [itemNum, connect, disconnect]);

  return { connected, reconnect: connect, disconnect };
}
