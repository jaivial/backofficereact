import { useCallback, useEffect, useRef, useState } from "react";

type WineAIWSMessage = {
  type: string;
  restaurant_id?: number;
  wine_num?: number;
  ai_requested?: boolean;
  ai_generating?: boolean;
  ai_generated_img?: string | null;
  foto_url?: string;
  message?: string;
};

export function useWineAIWebSocket(opts: {
  baseUrl?: string;
  wineNum: number | null;
  onEvent?: (msg: WineAIWSMessage) => void;
}) {
  const { wineNum, onEvent } = opts;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const connect = useCallback(() => {
    if (wsRef.current) return;
    const proto = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:3001";
    const url = `${proto}//${host}/api/admin/vinos/ws`;
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
        const msg: WineAIWSMessage = JSON.parse(ev.data);
        onEventRef.current?.(msg);
      } catch {
        // ignore malformed messages
      }
    };
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!wineNum) return;
    connect();
    return () => disconnect();
  }, [wineNum, connect, disconnect]);

  return { connected, reconnect: connect, disconnect };
}
