import { useCallback, useEffect, useRef, useState } from "react";

import {
  BOOKING_DOCUMENT_MAX_BYTES,
  bookingDocumentUrl,
  fileToBase64,
  type BookingDocument,
} from "../../../../../api/bookingDocuments";

/** Frames the reservations socket answers for booking documents. */
const REPLY_TYPES = new Set(["booking_documents", "booking_document_error", "booking_document_deleted"]);

/**
 * One websocket to `/api/admin/reservas/ws` for every booking-document action
 * (upload / list / delete). Every request is answered by a frame carrying the
 * same `correlation_id`, so concurrent uploads never mix up their replies.
 * Coordination id: booking_documents_v1
 */
export function useBookingDocumentsSocket(opts: { enabled?: boolean } = {}) {
  const { enabled = true } = opts;
  const socketRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const pendingRef = useRef<Map<string, (msg: any) => void>>(new Map());
  const counterRef = useRef(0);
  const [connected, setConnected] = useState(false);

  /** Sends a frame and resolves with the reply carrying the same correlation id. */
  const send = useCallback((build: (correlationId: string) => unknown, timeoutMs = 60_000): Promise<any> => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("Sin conexión con el servidor"));
    }
    counterRef.current += 1;
    const correlationId = `bdoc-${Date.now().toString(36)}-${counterRef.current}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRef.current.delete(correlationId);
        reject(new Error("El servidor no respondió a tiempo"));
      }, timeoutMs);
      pendingRef.current.set(correlationId, (msg) => {
        clearTimeout(timer);
        if (String(msg?.type || "").endsWith("_error")) {
          reject(new Error(String(msg?.message || "No se pudo completar la operación")));
          return;
        }
        resolve(msg);
      });
      try {
        socket.send(JSON.stringify(build(correlationId)));
      } catch (error) {
        clearTimeout(timer);
        pendingRef.current.delete(correlationId);
        reject(error instanceof Error ? error : new Error("No se pudo enviar el documento"));
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof WebSocket === "undefined") return;

    let disposed = false;
    let socket: WebSocket | null = null;

    const schedule = () => {
      if (disposed || retryRef.current) return;
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 15000);
      attemptsRef.current += 1;
      retryRef.current = setTimeout(() => {
        retryRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      try {
        socket = new WebSocket(`${proto}//${window.location.host}/api/admin/reservas/ws`);
      } catch {
        schedule();
        return;
      }
      socketRef.current = socket;

      socket.onopen = () => {
        attemptsRef.current = 0;
        setConnected(true);
      };
      socket.onmessage = (event) => {
        let msg: any;
        try { msg = JSON.parse(String(event.data ?? "")); } catch { return; }
        if (!REPLY_TYPES.has(String(msg?.type || ""))) return;
        const correlationId = String(msg?.correlation_id || "");
        if (!correlationId) return;
        const resolver = pendingRef.current.get(correlationId);
        if (!resolver) return;
        pendingRef.current.delete(correlationId);
        resolver(msg);
      };
      socket.onclose = () => {
        setConnected(false);
        socketRef.current = null;
        schedule();
      };
      socket.onerror = () => socket?.close();
    };

    connect();

    return () => {
      disposed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = null;
      socketRef.current = null;
      setConnected(false);
      socket?.close();
      pendingRef.current.forEach((resolve) => resolve({ type: "booking_document_error", message: "Conexión cerrada" }));
      pendingRef.current.clear();
    };
  }, [enabled]);

  /** Uploads any file type and resolves with the created (draft) document. */
  const upload = useCallback(
    async (file: File, title: string, bookingId?: number | null): Promise<BookingDocument> => {
      if (file.size > BOOKING_DOCUMENT_MAX_BYTES) {
        throw new Error(`El archivo supera el máximo de ${Math.round(BOOKING_DOCUMENT_MAX_BYTES / (1024 * 1024))} MB`);
      }
      const data = await fileToBase64(file);
      const message = await send((correlation_id) => ({
        type: "booking_document_upload",
        ...(bookingId ? { booking_id: bookingId } : {}),
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        title: title.trim() || file.name,
        data,
        correlation_id,
      }));
      const document = (message?.document ?? message) as BookingDocument;
      if (!document?.id) throw new Error("El servidor no devolvió el documento");
      return { ...document, url: document.url || bookingDocumentUrl(document.id) };
    },
    [send],
  );

  const list = useCallback(
    async (bookingId: number): Promise<BookingDocument[]> => {
      const message = await send(
        (correlation_id) => ({ type: "booking_documents_list", booking_id: bookingId, correlation_id }),
        20_000,
      );
      const rows = Array.isArray(message?.documents) ? message.documents : [];
      return rows.map((doc: BookingDocument) => ({ ...doc, url: doc.url || bookingDocumentUrl(doc.id) }));
    },
    [send],
  );

  const remove = useCallback(
    async (bookingId: number, documentId: number): Promise<void> => {
      await send((correlation_id) => ({
        type: "booking_document_delete",
        booking_id: bookingId,
        document_id: documentId,
        correlation_id,
      }));
    },
    [send],
  );

  return { connected, upload, list, remove };
}
