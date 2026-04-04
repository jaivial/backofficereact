import { useCallback, useEffect, useRef, useState } from "react";
import { useToasts } from "../../../../../ui/feedback/useToasts";

type ComidaAIEvent = {
  type: string;
  tipo?: string;
  item_id?: number;
  foto_url?: string;
  message?: string;
  restaurant_id?: number;
};

export function useComidaAI(restaurantId?: number) {
  const { pushToast } = useToasts();
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const onEvent = useCallback(
    (data: ComidaAIEvent) => {
      switch (data.type) {
        case "comida_ai_started":
          setGenerating(true);
          break;
        case "comida_ai_completed":
          setGenerating(false);
          if (data.foto_url) setImageUrl(data.foto_url);
          pushToast({ kind: "success", title: "Imagen AI generada" });
          break;
        case "comida_ai_failed":
          setGenerating(false);
          pushToast({ kind: "error", title: "Error", message: data.message || "No se pudo generar la imagen AI" });
          break;
      }
    },
    [pushToast],
  );

  useEffect(() => {
    if (!restaurantId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/admin/comida/ws`;

    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // Connection established
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as ComidaAIEvent;
          onEvent(data);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        // Error will trigger onclose
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [restaurantId, onEvent]);

  return { generating, imageUrl, setImageUrl };
}
