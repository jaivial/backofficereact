import { useCallback, useEffect, useRef, useState } from "react";
import { useToasts } from "../../../../../ui/feedback/useToasts";

export type ComidaAIEvent = {
  type: string;
  tipo?: string;
  item_id?: number;
  foto_url?: string;
  message?: string;
  restaurant_id?: number;
};

type UseComidaAIOptions = {
  onEvent?: (event: ComidaAIEvent) => void;
};

export function useComidaAI(restaurantId?: number, options?: UseComidaAIOptions) {
  const { pushToast } = useToasts();
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  const handleInternalEvent = useCallback(
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

  const onMessage = useCallback(
    (data: ComidaAIEvent) => {
      handleInternalEvent(data);
      onEventRef.current?.(data);
    },
    [handleInternalEvent],
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
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as ComidaAIEvent;
          onMessage(data);
        } catch {
        }
      };

      ws.onerror = () => {
      };

      ws.onclose = () => {
        wsRef.current = null;
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
  }, [restaurantId, onMessage]);

  return { generating, imageUrl, setImageUrl };
}
