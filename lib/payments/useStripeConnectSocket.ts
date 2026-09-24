import { useEffect, useRef, useState } from "react";

import type { StripeConnectStatus } from "../../api/types";

/**
 * Live Stripe Connect status for Config > Cobros online.
 * One WebSocket (/api/admin/config/stripe-connect/ws) while the tab is mounted;
 * the backend pushes `hello` on connect and `stripe_connect_status` whenever the
 * restaurant's account changes (Connect webhook account.updated, onboarding,
 * demo, delete). Reconnects with backoff and re-syncs on every (re)connect.
 * Coordination id: stripe_connect_multitenant_v1.ws
 */
export type StripeConnectSocketState = "connecting" | "open" | "closed";

const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 15000;

export function useStripeConnectSocket(onStatus: (connect: StripeConnectStatus, source: "hello" | "push") => void, enabled = true) {
  const [state, setState] = useState<StripeConnectSocketState>("connecting");
  const handler = useRef(onStatus);
  handler.current = onStatus;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof WebSocket === "undefined") return;
    let ws: WebSocket | null = null;
    let retry: number | null = null;
    let attempts = 0;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      setState("connecting");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${window.location.host}/api/admin/config/stripe-connect/ws`);
      ws.onopen = () => {
        attempts = 0;
        setState("open");
        console.log("[checkpoint] stripe_connect_ws_open");
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data || "{}")) as { type?: string; connect?: StripeConnectStatus };
          if ((msg.type === "hello" || msg.type === "stripe_connect_status") && msg.connect) {
            console.log("[checkpoint] stripe_connect_ws_status", msg.type, msg.connect.status);
            handler.current(msg.connect, msg.type === "hello" ? "hello" : "push");
          }
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = (ev) => {
        ws = null;
        setState("closed");
        if (stopped || ev.code === 4401) return; // unauthorized: do not hammer
        const wait = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * 2 ** attempts);
        attempts += 1;
        retry = window.setTimeout(connect, wait);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      stopped = true;
      if (retry !== null) window.clearTimeout(retry);
      ws?.close();
    };
  }, [enabled]);

  return state;
}
