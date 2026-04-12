import { useCallback, useEffect, useRef, useState } from "react";
import { useToasts } from "../../../../../ui/feedback/useToasts";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ComidaAIWSMessage = {
  type: string;
  restaurant_id?: number;
  tipo?: string;
  item_id?: number;
  foto_url?: string;
  message?: string;
};

type ListEventHandler = (msg: ComidaAIWSMessage) => void;
type DetailEventHandler = (msg: ComidaAIWSMessage) => void;

// ---------------------------------------------------------------------------
// Module-level singleton
// ---------------------------------------------------------------------------

let singletonWs: WebSocket | null = null;
let singletonListeners: Set<(event: ComidaAIWSMessage) => void> = new Set();

/**
 * Registers a listener with the module-level singleton WebSocket.
 * Returns an unsubscribe function.
 */
function addSingletonListener(handler: (event: ComidaAIWSMessage) => void): () => void {
  singletonListeners.add(handler);
  return () => {
    singletonListeners.delete(handler);
  };
}

/**
 * Broadcasts an event to all singleton listeners.
 */
function broadcastToListeners(event: ComidaAIWSMessage): void {
  for (const listener of singletonListeners) {
    listener(event);
  }
}

/**
 * Ensures the singleton WebSocket is open. Idempotent — no-op if already connected.
 */
function ensureSingletonConnected(): void {
  if (singletonWs && singletonWs.readyState === WebSocket.OPEN) return;

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const wsUrl = `${proto}//${host}/api/admin/comida/ws`;

  const ws = new WebSocket(wsUrl);
  singletonWs = ws;

  ws.onopen = () => {};

  ws.onmessage = (ev) => {
    try {
      const msg: ComidaAIWSMessage = JSON.parse(ev.data);
      broadcastToListeners(msg);
    } catch {
      // ignore malformed messages
    }
  };

  ws.onerror = () => {
    // Let onclose handle cleanup
  };

  ws.onclose = () => {
    singletonWs = null;
    // Reconnect after delay if there are still listeners
    if (singletonListeners.size > 0) {
      setTimeout(ensureSingletonConnected, 3000);
    }
  };
}

// ---------------------------------------------------------------------------
// Per-scope filter functions
// ---------------------------------------------------------------------------

/**
 * Returns true when the message should be forwarded to a "list" consumer.
 * List events are those that carry a restaurant-level signal (not tied to a specific item).
 */
function isListEvent(msg: ComidaAIWSMessage): boolean {
  // If item_id is set, it's a detail-scoped event
  if (msg.item_id !== undefined) return false;
  return true;
}

/**
 * Returns true when the message should be forwarded to a "detail" consumer
 * tracking the given itemNum.
 */
function isDetailEvent(msg: ComidaAIWSMessage, itemNum: number | null): boolean {
  if (itemNum === null) return false;
  return msg.item_id === itemNum;
}

// ---------------------------------------------------------------------------
// useComidaAIUnified hook
// ---------------------------------------------------------------------------

export type ComidaAIUnifiedScope = "list" | "detail" | "all";

export interface UseComidaAIUnifiedOptions {
  /**
   * Scope of events to handle:
   *  - "list":   only restaurant-level events (no item_id)
   *  - "detail": only events for the tracked item
   *  - "all":    both list and detail events
   */
  scope?: ComidaAIUnifiedScope;
  /**
   * When scope="detail", the item number to filter events for.
   */
  itemNum?: number | null;
  /**
   * Optional external handler called for every matched event.
   */
  onEvent?: (msg: ComidaAIWSMessage) => void;
}

/**
 * Unified ComidaAI WebSocket hook.
 *
 * Uses a module-level singleton WebSocket to avoid duplicate connections.
 * Consumers specify a `scope` to filter which event types they receive:
 *  - "list":   restaurant-level events (menu refresh, etc.)
 *  - "detail": per-item events (AI image generation completed)
 *  - "all":    both
 *
 * Note: When multiple components use the same scope on the same page,
 * they will all receive the same events. Use `itemNum` to scope a
 * detail consumer to a specific item.
 */
export function useComidaAIUnified(options: UseComidaAIUnifiedOptions = {}) {
  const { scope = "all", itemNum = null, onEvent } = options;
  const { pushToast } = useToasts();

  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handleInternalEvent = useCallback(
    (msg: ComidaAIWSMessage) => {
      switch (msg.type) {
        case "comida_ai_started":
          setGenerating(true);
          break;
        case "comida_ai_completed":
          setGenerating(false);
          if (msg.foto_url) setImageUrl(msg.foto_url);
          pushToast({ kind: "success", title: "Imagen AI generada" });
          break;
        case "comida_ai_failed":
          setGenerating(false);
          pushToast({
            kind: "error",
            title: "Error",
            message: msg.message || "No se pudo generar la imagen AI",
          });
          break;
      }
    },
    [pushToast],
  );

  const shouldHandle = useCallback(
    (msg: ComidaAIWSMessage): boolean => {
      if (scope === "list") return isListEvent(msg);
      if (scope === "detail") return isDetailEvent(msg, itemNum);
      // scope === "all"
      return isListEvent(msg) || isDetailEvent(msg, itemNum);
    },
    [scope, itemNum],
  );

  useEffect(() => {
    // Ensure the singleton WS is running
    ensureSingletonConnected();

    const unsubscribe = addSingletonListener((msg) => {
      if (!shouldHandle(msg)) return;
      handleInternalEvent(msg);
      onEventRef.current?.(msg);
    });

    return unsubscribe;
  }, [scope, itemNum, shouldHandle, handleInternalEvent]);

  return { generating, imageUrl, setImageUrl };
}
