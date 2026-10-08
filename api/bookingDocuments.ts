/**
 * Booking documents (booking_documents_v1).
 *
 * SINGLE SOURCE OF TRUTH for every booking-document call of the backoffice:
 * the socket frames used to upload / list / delete, the draft ids that the
 * booking-create call binds, and the flag that ships documents to the client.
 * Nothing else in the app builds these message shapes, so a server-side rename
 * only has to be fixed here.
 *
 * Protocol (websocket `/api/admin/reservas/ws`, JSON frames):
 *   -> { type: "booking_document_upload", booking_id?: number, filename,
 *        content_type, title, data (base64), correlation_id }
 *   <- { type: "booking_document_uploaded", document_id, document: {...} }
 *   <- { type: "booking_document_error", correlation_id, message }
 *   -> { type: "booking_documents_list", booking_id }
 *   <- { type: "booking_documents", booking_id, documents: [...] }
 *   -> { type: "booking_document_delete", booking_id, document_id }
 *   <- { type: "booking_document_deleted", booking_id, document_id }
 */

/** A document as the backoffice consumes it (drafts included: booking_id null). */
export type BookingDocument = {
  id: number;
  booking_id: number | null;
  title: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at?: string;
  /** Same-origin proxy that streams the private stored object. */
  url?: string;
};

/** Shapes sent by the client; replies are handled by the caller. */
export type BookingDocumentUploadMessage = {
  type: "booking_document_upload";
  /** Absent while the booking does not exist yet (draft upload). */
  booking_id?: number;
  filename: string;
  content_type: string;
  title: string;
  data: string;
  correlation_id: string;
};

export type BookingDocumentsListMessage = { type: "booking_documents_list"; booking_id: number };
export type BookingDocumentDeleteMessage = { type: "booking_document_delete"; booking_id: number; document_id: number };

/** Booking-create payload field that binds the uploaded draft ids. */
export const BOOKING_DOCUMENTS_FIELD = "document_ids";
/** Booking-create / patch payload field that ships documents to the client. */
export const BOOKING_SEND_DOCUMENTS_FIELD = "send_documents_to_client";

/** Server-side cap (bytes). Mirrors the backend reject threshold. */
export const BOOKING_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/** Streaming URL of a stored document (session cookie makes it authenticate). */
export function bookingDocumentUrl(id: number): string {
  return `/api/admin/bookings/documents/${encodeURIComponent(String(id))}`;
}

/** Absolute URL for share sheets / "open full page" (relative paths do not share). */
export function bookingDocumentAbsoluteUrl(id: number): string {
  if (typeof window === "undefined") return bookingDocumentUrl(id);
  return `${window.location.origin}${bookingDocumentUrl(id)}`;
}

export function bookingDocumentDownloadName(doc: Pick<BookingDocument, "title" | "original_filename">): string {
  const raw = String(doc.original_filename || doc.title || "documento").trim() || "documento";
  return raw;
}

export function formatBytes(bytes: number): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Base64 of a file for the socket upload (chunked, no spread-arg overflow). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result || "");
      // Keep only the payload: the server decodes base64, not a data URL.
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Coarse kind used by the preview step. Content type first (what the browser
 * believes), extension as fallback (uploads often arrive without a type).
 */
export type DocumentKind = "image" | "pdf" | "markdown" | "text" | "docx" | "sheet" | "other";

export function documentKind(doc: Pick<BookingDocument, "content_type" | "original_filename">): DocumentKind {
  const type = String(doc.content_type || "").toLowerCase().split(";")[0].trim();
  const ext = String(doc.original_filename || "").toLowerCase().split(".").pop() || "";
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || ext === "pdf") return "pdf";
  if (
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type === "application/msword" ||
    ext === "docx" ||
    ext === "doc"
  ) return "docx";
  if (
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel" ||
    type === "text/csv" ||
    type === "application/csv" ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  ) return "sheet";
  if (type === "text/markdown" || ext === "md" || ext === "markdown") return "markdown";
  if (type.startsWith("text/") || ext === "txt" || ext === "log") return "text";
  return "other";
}
