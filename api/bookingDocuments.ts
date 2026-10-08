/**
 * Booking documents (booking_documents_v1).
 *
 * SINGLE SOURCE OF TRUTH for every booking-document call of the backoffice.
 * The frames mirror `internal/api/backoffice_booking_documents_ws.go` (backend
 * e2ddd38) exactly: camelCase type names, a `requestId` echoed on every reply,
 * and an error frame per action named `<action>Error`. Nothing else in the app
 * builds these shapes, so a server-side rename only has to be fixed here.
 *
 * Socket: GET /api/admin/bookings/documents/ws (JSON text frames)
 *   -> { type: "bookingDocumentUpload", requestId, filename, mimeType, title,
 *        bookingId: number|null (null = draft), dataBase64 }
 *   <- { type: "bookingDocumentUploadOk",  requestId, document }
 *   <- { type: "bookingDocumentUploadError", requestId, code, message }
 *   -> { type: "bookingDocumentList", requestId, bookingId }   (0 = my drafts)
 *   <- { type: "bookingDocumentListOk", requestId, documents, drafts }
 *   <- { type: "bookingDocumentListError", requestId, code, message }
 *   -> { type: "bookingDocumentDelete", requestId, id, confirmed: true }
 *   <- { type: "bookingDocumentDeleteOk", requestId, id }
 *   <- { type: "bookingDocumentDeleteError", requestId, code, message }
 *   <- { type: "bookingDocumentDeleteConfirm", requestId, id, message }
 *      (server answer to a delete WITHOUT confirmed:true; nothing was deleted)
 *
 * REST:
 *   GET /api/admin/bookings/{id}/documents  -> { success, documents }
 *   GET /api/admin/bookings/documents/{docId}/file -> the bytes
 *   POST /api/admin/bookings | PATCH /api/admin/bookings/{id} accept
 *   `document_ids` (draft ids to bind) and `send_documents_to_client`.
 */

/** A document exactly as the backend serialises it (`bookingDocument`). */
export type BookingDocument = {
  id: number;
  restaurant_id: number;
  booking_id: number | null;
  uploaded_by: number;
  title: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
  /** Same-origin, session-authenticated URL of the bytes. */
  url: string;
  cdn_url: string;
  is_image: boolean;
};

/** Request frames (client -> server). */
export type BookingDocumentUploadMessage = {
  type: "bookingDocumentUpload";
  requestId: string;
  filename: string;
  mimeType: string;
  title: string;
  /** null while the booking does not exist yet: the document stays a draft. */
  bookingId: number | null;
  dataBase64: string;
};

export type BookingDocumentListMessage = { type: "bookingDocumentList"; requestId: string; bookingId: number };

export type BookingDocumentDeleteMessage = {
  type: "bookingDocumentDelete";
  requestId: string;
  id: number;
  /** The server refuses to delete without it. */
  confirmed: boolean;
};

/** Reply of `bookingDocumentListOk`. */
export type BookingDocumentListOk = { documents: BookingDocument[]; drafts: BookingDocument[] };

/** Booking-create / patch payload fields (backoffice_booking_mutations.go). */
export const BOOKING_DOCUMENTS_FIELD = "document_ids";
export const BOOKING_SEND_DOCUMENTS_FIELD = "send_documents_to_client";

/**
 * Cap of ANY upload, mirroring `bookingDocumentMaxUploadBytes` (25 MB).
 * The server enforces the same value; the client check only avoids buffering
 * a frame the server would reject anyway.
 */
export const BOOKING_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Images are re-encoded server-side down to `bookingDocumentMaxImageBytes`
 * (2 MB stored). There is no separate INPUT cap for images: the 25 MB upload
 * cap above is the only one, so nothing extra is enforced client-side.
 */
export const BOOKING_DOCUMENT_MAX_DOCUMENTS = 50;

/** Streaming URL of a stored document. Prefer the server-provided `url`. */
export function bookingDocumentFileUrl(docId: number): string {
  return `/api/admin/bookings/documents/${encodeURIComponent(String(docId))}/file`;
}

/** Absolute URL for share sheets / "open full page" (a relative path cannot be shared). */
export function bookingDocumentAbsoluteUrl(doc: Pick<BookingDocument, "id" | "url">): string {
  if (typeof window === "undefined") return doc.url || bookingDocumentFileUrl(doc.id);
  return `${window.location.origin}${doc.url || bookingDocumentFileUrl(doc.id)}`;
}

export function bookingDocumentDownloadName(doc: Pick<BookingDocument, "title" | "original_filename">): string {
  return String(doc.original_filename || doc.title || "documento").trim() || "documento";
}

export function formatBytes(bytes: number): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Base64 of a file for the socket upload (the server also accepts a data URL). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result || "");
      // Send raw base64; the server strips a data: prefix but does not need one.
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

export function documentKind(doc: Pick<BookingDocument, "content_type" | "original_filename" | "is_image">): DocumentKind {
  const type = String(doc.content_type || "").toLowerCase().split(";")[0].trim();
  const ext = String(doc.original_filename || "").toLowerCase().split(".").pop() || "";
  if (doc.is_image || type.startsWith("image/")) return "image";
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
