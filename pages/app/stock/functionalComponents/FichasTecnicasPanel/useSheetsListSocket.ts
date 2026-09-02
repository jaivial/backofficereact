import { useEffect, useRef } from "react";

// Live refresh for the sheets grid on /app/stock?tab=sheets.
//
// Same contract as the editor's useSheetImageSocket: the socket is a
// notification channel, not a data source. Every message just tells the grid
// to re-read its current page over REST, so a dropped frame costs a moment of
// staleness rather than a card that disagrees with the database.

export function useSheetsListSocket(onImageJob: () => void) {
  // Held in a ref so a new callback identity does not tear down the socket.
  const handlerRef = useRef(onImageJob);
  useEffect(() => {
    handlerRef.current = onImageJob;
  }, [onImageJob]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    let attempt = 0;

    const connect = () => {
      if (closed) return;
      try {
        socket = new WebSocket(`${protocol}//${window.location.host}/api/admin/comida/technical-sheets/ws`);
      } catch {
        // A failed construction is retried on the same backoff as a drop.
        schedule();
        return;
      }
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data));
          if (message?.type === "imageJob") handlerRef.current();
        } catch {
          // A frame we cannot parse is ignored; REST still has the truth.
        }
      };
      socket.onclose = schedule;
    };

    function schedule() {
      if (closed || retry) return;
      // Capped exponential backoff so a backend restart does not turn into a
      // reconnect storm from every open tab.
      const delay = Math.min(1000 * 2 ** attempt, 15000);
      attempt += 1;
      retry = setTimeout(() => {
        retry = null;
        connect();
      }, delay);
    }

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      if (socket) {
        socket.onclose = null;
        socket.onmessage = null;
        if (socket.readyState === WebSocket.CONNECTING) {
          // Closing a socket that is still handshaking makes the browser log
          // "closed before the connection is established". Waiting for the
          // handshake and closing then keeps the console clean.
          const pending = socket;
          pending.onopen = () => pending.close();
        } else {
          socket.close();
        }
      }
    };
  }, []);
}
