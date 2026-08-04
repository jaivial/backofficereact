import { useCallback, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../state/atoms";

/**
 * Site-builder realtime bridge — RPC over WebSocket for all post-load CRUD.
 *
 * Mirrors FichajeRealtimeBridge: connects to /api/admin/site-builder/ws,
 * scoped by activeRestaurantId, exponential reconnect. Adds a requestId →
 * promise map so the editor calls `send({ type, payload })` and awaits the
 * ack, matching the Go hub's { type:'ack'|'error', requestId, result } frames.
 */

const BASE_RETRY_MS = 800;
const MAX_RETRY_MS = 8000;

export type SiteBuilderFrame = {
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
  result?: unknown;
};

export function siteBuilderWsURL(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/admin/site-builder/ws`;
}

export function useSiteBuilderRealtime() {
  const session = useAtomValue(sessionAtom);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map());
  const connectedRef = useRef<boolean>(false);
  const seqRef = useRef<number>(0);
  const listenersRef = useRef<Set<(frame: SiteBuilderFrame) => void>>(new Set());

  const cleanup = useCallback(() => {
    if (retryRef.current) {
      window.clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    connectedRef.current = false;
    // Reject all pending RPCs.
    for (const [, p] of pendingRef.current) p.reject(new Error("ws closed"));
    pendingRef.current.clear();
  }, []);

  const connect = useCallback(() => {
    cleanup();
    if (!session?.activeRestaurantId) return;

    const ws = new WebSocket(siteBuilderWsURL());
    wsRef.current = ws;

    ws.onopen = () => {
      connectedRef.current = true;
      // Scope the connection to the active restaurant.
      ws.send(JSON.stringify({ type: "hello", payload: { restaurantId: session.activeRestaurantId } }));
    };

    ws.onmessage = (ev) => {
      let frame: SiteBuilderFrame;
      try {
        frame = JSON.parse(String(ev.data)) as SiteBuilderFrame;
      } catch {
        return;
      }
      if (frame.requestId) {
        const p = pendingRef.current.get(frame.requestId);
        if (p) {
          pendingRef.current.delete(frame.requestId);
          if (frame.type === "error") {
            p.reject(new Error(String((frame.payload as any)?.message ?? frame.result ?? "site-builder error")));
          } else {
            p.resolve(frame.result ?? frame.payload ?? null);
          }
        }
      }
      for (const fn of listenersRef.current) fn(frame);
    };

    ws.onclose = () => {
      connectedRef.current = false;
      for (const [, p] of pendingRef.current) p.reject(new Error("ws closed"));
      pendingRef.current.clear();
      if (!retryRef.current) {
        const delay = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** (seqRef.current % 5));
        seqRef.current += 1;
        retryRef.current = window.setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose handles reconnect.
    };
  }, [cleanup, session?.activeRestaurantId]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  const send = useCallback(
    (type: string, payload?: Record<string, unknown>, requestId?: string): Promise<unknown> => {
      const id = requestId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      return new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("site-builder ws not connected"));
          return;
        }
        pendingRef.current.set(id, { resolve, reject });
        ws.send(JSON.stringify({ type, requestId: id, payload: payload ?? {} }));
        // Hard timeout so a dropped ack doesn't hang the editor.
        window.setTimeout(() => {
          if (pendingRef.current.has(id)) {
            pendingRef.current.delete(id);
            reject(new Error(`site-builder request ${type} timed out`));
          }
        }, 20000);
      });
    },
    []
  );

  const subscribe = useCallback((fn: (frame: SiteBuilderFrame) => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  }, []);

  const isConnected = connectedRef.current;

  return { send, subscribe, isConnected };
}
