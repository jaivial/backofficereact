import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { useAtomValue } from "jotai";

import { sessionAtom } from "../../state/atoms";

/**
 * GlobalSocketProvider — single WebSocket per backoffice session.
 *
 * The backoffice used to open one socket per feature (fichaje, columns,
 * reservas, AI editors, etc.). That wasted a connection per tab and
 * made the server hold N idle sockets per operator. This provider opens
 * exactly ONE socket per session and lets every feature subscribe to a
 * named topic ("special_date", "fichaje", "columns", …). The backend
 * hub fans out the same event to every connected client of the same
 * restaurant.
 *
 * Coordination id: global_socket_provider_v1
 *
 * Usage:
 *
 *   // At the app shell
 *   <GlobalSocketProvider>{children}</GlobalSocketProvider>
 *
 *   // Anywhere downstream
 *   const { connected } = useGlobalSocket();
 *   useGlobalSocketTopic("special_date", (payload) => {
 *     // patch local cache with the saved row
 *   });
 */

export type GlobalSocketTopicHandler<T = unknown> = (payload: T) => void;

export type GlobalSocketState = {
  connected: boolean;
  connecting: boolean;
};

const BASE_RETRY_MS = 800;
const MAX_RETRY_MS = 8000;

type AnyHandler = GlobalSocketTopicHandler<unknown>;
type TopicMap = Map<string, Set<AnyHandler>>;

type GlobalSocketContextValue = GlobalSocketState & {
  publish: (topic: string, payload: unknown) => boolean;
  subscribe: (topic: string, handler: AnyHandler) => () => void;
};

const GlobalSocketContext = createContext<GlobalSocketContextValue | null>(null);

type GlobalSession = {
  user: { id: number };
  restaurants?: Array<{ id: number }>;
  activeRestaurantId?: number;
};

function sessionKey(session: GlobalSession): number {
  return session.activeRestaurantId ?? session.restaurants?.[0]?.id ?? 0;
}

function wsURL(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/admin/ws`;
}

type Envelope = {
  type: string;
  payload: unknown;
};

export function GlobalSocketProvider({ children }: { children: React.ReactNode }) {
  const session = useAtomValue(sessionAtom);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const topicsRef = useRef<TopicMap>(new Map());
  const attemptsRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const closedRef = useRef(false);

  const subscribe = useCallback((topic: string, handler: AnyHandler) => {
    const map = topicsRef.current;
    let set = map.get(topic);
    if (!set) {
      set = new Set();
      map.set(topic, set);
    }
    set.add(handler);
    return () => {
      const cur = topicsRef.current.get(topic);
      if (!cur) return;
      cur.delete(handler);
      if (cur.size === 0) topicsRef.current.delete(topic);
    };
  }, []);

  const publish = useCallback((topic: string, payload: unknown) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const env: Envelope = { type: topic, payload };
    try {
      ws.send(JSON.stringify(env));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const sk = sessionKey(session as GlobalSession);
    if (!sk) {
      closedRef.current = true;
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          /* ignore */
        }
        wsRef.current = null;
      }
      setConnected(false);
      setConnecting(false);
      return;
    }

    closedRef.current = false;

    const open = () => {
      if (closedRef.current) return;
      if (wsRef.current) return;
      setConnecting(true);
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsURL());
      } catch {
        setConnecting(false);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;
      ws.onopen = () => {
        attemptsRef.current = 0;
        setConnecting(false);
        setConnected(true);
      };
      ws.onclose = () => {
        setConnected(false);
        setConnecting(false);
        if (wsRef.current === ws) wsRef.current = null;
        if (!closedRef.current) scheduleReconnect();
      };
      ws.onerror = () => {
        // onclose will fire next; let it handle the reconnect.
      };
      ws.onmessage = (ev) => {
        let env: Envelope | null = null;
        try {
          env = JSON.parse(typeof ev.data === "string" ? ev.data : "") as Envelope;
        } catch {
          return;
        }
        if (!env || typeof env.type !== "string") return;
        const set = topicsRef.current.get(env.type);
        if (!set) return;
        for (const handler of Array.from(set)) {
          try {
            handler(env.payload);
          } catch {
            // swallow — one bad handler must not break the others
          }
        }
      };
    };

    const scheduleReconnect = () => {
      if (closedRef.current) return;
      attemptsRef.current += 1;
      const delay = Math.min(
        MAX_RETRY_MS,
        BASE_RETRY_MS * Math.pow(2, attemptsRef.current),
      );
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        open();
      }, delay);
    };

    open();

    return () => {
      closedRef.current = true;
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
      setConnected(false);
      setConnecting(false);
    };
  }, [session]);

  const value: GlobalSocketContextValue = {
    connected,
    connecting,
    publish,
    subscribe,
  };

  return (
    <GlobalSocketContext.Provider value={value}>
      {children}
    </GlobalSocketContext.Provider>
  );
}

export function useGlobalSocket(): GlobalSocketContextValue {
  const ctx = useContext(GlobalSocketContext);
  if (!ctx) {
    throw new Error(
      "useGlobalSocket must be used inside <GlobalSocketProvider>",
    );
  }
  return ctx;
}

/**
 * Subscribe to a global topic. The handler is called with the
 * `payload` field of the matching envelope. The returned function
 * unsubscribes.
 */
export function useGlobalSocketTopic<T = unknown>(
  topic: string,
  handler: GlobalSocketTopicHandler<T>,
): boolean {
  const ctx = useContext(GlobalSocketContext);
  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(topic, handler as AnyHandler);
  }, [ctx, topic, handler]);
  return ctx?.connected ?? false;
}
