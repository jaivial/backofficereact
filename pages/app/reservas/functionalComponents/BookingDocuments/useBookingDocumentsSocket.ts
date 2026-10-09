import { useCallback, useEffect, useRef, useState } from "react";
import {
  fileToBase64,
  type BookingDocument,
  type BookingDocumentListOk,
  type BookingDocumentListMessage,
  type BookingDocumentDeleteMessage,
  type BookingDocumentUploadMessage,
} from "../../../../../api/bookingDocuments";
import { prepareImageForUpload } from "../../../../../lib/imageUpload";

/**
 * One socket for the whole booking-documents flow (upload / list / delete).
 *
 * Transport: GET /api/admin/bookings/documents/ws, its own endpoint so a large
 * upload never queues behind the reservas columns traffic. `reservas/ws` stays
 * with the columns realtime hook.
 *
 * Correlation: every request carries a `requestId` the server echoes on its
 * reply, so concurrent uploads resolve independently. The server answers
 * `<action>Ok` on success, `<action>Error` on failure, and
 * `bookingDocumentDeleteConfirm` when a delete arrives without
 * `confirmed: true` (nothing was deleted).
 */

export type BookingDocumentsSocket = {
  /** Uploads one file. `bookingId` null keeps the document as a draft. */
  upload(file: File, title: string, bookingId?: number | null): Promise<BookingDocument>;
  /** Documents of a booking (bookingId 0 lists the caller's own drafts). */
  list(bookingId: number): Promise<BookingDocumentListOk>;
  /** Deletes a document. Only call after the user confirmed. */
  remove(documentId: number): Promise<number>;
  /** False until the socket is open; callers block work while it is down. */
  connected: boolean;
};

type Pending = { resolve: (value: never) => void; reject: (error: Error) => void; timer: number };

const OK_TYPES = new Set(["bookingDocumentUploadOk", "bookingDocumentListOk", "bookingDocumentDeleteOk"]);
const ERROR_TYPES = new Set(["bookingDocumentError", "bookingDocumentUploadError", "bookingDocumentListError", "bookingDocumentDeleteError"]);
const CONFIRM_TYPE = "bookingDocumentDeleteConfirm";
const REQUEST_TIMEOUT_MS = 90_000;

function socketUrl(): string {
  if (typeof window === "undefined") return "";
  const scheme = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${window.location.host}/api/admin/bookings/documents/ws`;
}

let seq = 0;
function nextRequestId(): string {
  seq += 1;
  return `bd-${Date.now().toString(36)}-${seq}`;
}

function messageOf(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function useBookingDocumentsSocket(options: { enabled?: boolean } = {}): BookingDocumentsSocket {
  const enabled = options.enabled ?? true;
  const socketRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, Pending>());
  const retryRef = useRef(0);
  const closedRef = useRef(false);
  const [connected, setConnected] = useState(false);

  /** Rejects every in-flight request; a socket close can never leave one hanging. */
  const settleAll = useCallback((error: Error) => {
    const pending = pendingRef.current;
    pendingRef.current = new Map();
    pending.forEach((entry) => {
      window.clearTimeout(entry.timer);
      entry.reject(error);
    });
  }, []);

  const send = useCallback(
    (build: (requestId: string) => unknown): Promise<never> =>
      new Promise<never>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
          reject(new Error("Sin conexión con el servidor"));
          return;
        }
        const requestId = nextRequestId();
        const timer = window.setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error("El servidor no respondió a tiempo"));
        }, REQUEST_TIMEOUT_MS);
        pendingRef.current.set(requestId, { resolve: resolve as (value: never) => void, reject, timer });
        socket.send(JSON.stringify(build(requestId)));
      }),
    [],
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    closedRef.current = false;
    let socket: WebSocket | null = null;
    let retryTimer: number | undefined;

    const connect = () => {
      if (closedRef.current) return;
      const url = socketUrl();
      if (!url) return;
      socket = new WebSocket(url);

      socket.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(event.data));
        } catch {
          return;
        }
        const message = messageOf(parsed);
        const type = String(message.type || "");
        if (type === "pong" || type === "connected") return;
        const requestId = String(message.requestId || "");
        if (!requestId) return;
        const pending = pendingRef.current.get(requestId);
        if (!pending) return;
        pendingRef.current.delete(requestId);
        window.clearTimeout(pending.timer);
        if (OK_TYPES.has(type)) {
          pending.resolve(message as never);
        } else if (ERROR_TYPES.has(type)) {
          pending.reject(new Error(String(message.message || "Error del servidor")));
        } else if (type === CONFIRM_TYPE) {
          // The server asks for a confirmation instead of deleting. Nothing was
          // removed, so the caller has to ask the user and resend confirmed.
          pending.reject(new Error(String(message.message || "Se requiere confirmación")));
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        setConnected(false);
        settleAll(new Error("Se perdió la conexión"));
        if (closedRef.current) return;
        // Capped exponential backoff; the socket is chatty on a big day.
        const attempt = Math.min(retryRef.current, 4);
        retryRef.current += 1;
        retryTimer = window.setTimeout(connect, 500 * 2 ** attempt);
      };

      socket.onerror = () => {
        // onclose always follows; the retry lives there.
      };

      socketRef.current = socket;
    };

    connect();

    return () => {
      closedRef.current = true;
      setConnected(false);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      settleAll(new Error("Conexión cerrada"));
      const current = socketRef.current;
      socketRef.current = null;
      if (current) {
        current.onclose = null;
        current.onmessage = null;
        current.onerror = null;
        current.close();
      }
    };
  }, [enabled, settleAll]);

  const upload = useCallback(
    async (file: File, title: string, bookingId?: number | null): Promise<BookingDocument> => {
      // requestId is assigned by `send` (it is the correlation key of the
      // pending promise), so the frame is built without one.
      // Images go out prepared (<=2MB WebP); other documents pass through.
      const prepared = await prepareImageForUpload(file);
      const message: Omit<BookingDocumentUploadMessage, "requestId"> = {
        type: "bookingDocumentUpload",
        filename: prepared.name,
        mimeType: prepared.type || "application/octet-stream",
        title,
        // A draft has no booking yet; the server keeps it until the create binds it.
        bookingId: bookingId && bookingId > 0 ? bookingId : null,
        dataBase64: await fileToBase64(prepared),
      };
      const reply = await send((requestId) => ({ ...message, requestId }));
      const document = messageOf(reply).document as BookingDocument | undefined;
      // A well-formed bookingDocumentUploadOk always carries `document`. If it
      // ever does not, fail here rather than hand the caller a null that would
      // blow up later as "cannot read id of null", far from the real cause.
      if (!document || typeof document !== "object" || !Number(document.id)) {
        throw new Error("El servidor no devolvi\u00f3 el documento subido");
      }
      return document;
    },
    [send],
  );

  const list = useCallback(
    async (bookingId: number): Promise<BookingDocumentListOk> => {
      const message: Omit<BookingDocumentListMessage, "requestId"> = { type: "bookingDocumentList", bookingId };
      const reply = await send((requestId) => ({ ...message, requestId }));
      const replyMessage = messageOf(reply);
      return {
        documents: (replyMessage.documents || []) as BookingDocument[],
        drafts: (replyMessage.drafts || []) as BookingDocument[],
      };
    },
    [send],
  );

  const remove = useCallback(
    async (documentId: number): Promise<number> => {
      const message: Omit<BookingDocumentDeleteMessage, "requestId"> = {
        type: "bookingDocumentDelete",
        id: documentId,
        // Only ever sent after the confirmation dialog was accepted.
        confirmed: true,
      };
      const reply = await send((requestId) => ({ ...message, requestId }));
      return Number(messageOf(reply).id) || documentId;
    },
    [send],
  );

  return { upload, list, remove, connected };
}
