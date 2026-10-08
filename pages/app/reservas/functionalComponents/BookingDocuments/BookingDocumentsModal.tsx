import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, Download, ExternalLink, Share2, Trash2, Upload } from "lucide-react";

import {
  BOOKING_DOCUMENT_MAX_BYTES,
  BOOKING_DOCUMENT_MAX_DOCUMENTS,
  BOOKING_DOCUMENT_MAX_IMAGE_INPUT_BYTES,
  bookingDocumentAbsoluteUrl,
  bookingDocumentDownloadName,
  type BookingDocument,
} from "../../../../../api/bookingDocuments";
import { Modal } from "../../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../../ui/overlays/ModalHeader";
import { ConfirmDialog } from "../../../../../ui/overlays/ConfirmDialog";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { DocumentAttachmentField } from "./DocumentAttachmentField";
import { DocumentPreview } from "./DocumentPreview";
import { useBookingDocumentsSocket } from "./useBookingDocumentsSocket";

/**
 * "Documentos" modal of the reservations table: list, delete, upload and preview
 * of the documents attached to a booking. The list and the preview are two
 * steps of the SAME modal (the preview slides over the list).
 * Coordination id: booking_documents_v1
 */
export function BookingDocumentsModal({ bookingId, onClose }: { bookingId: number | null; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const { list, remove, upload, connected } = useBookingDocumentsSocket({ enabled: bookingId != null });

  const [documents, setDocuments] = useState<BookingDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openDoc, setOpenDoc] = useState<BookingDocument | null>(null);
  useErrorToast(error);

  const reload = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      const reply = await list(bookingId);
      setDocuments(reply.documents);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos");
    } finally {
      setLoading(false);
    }
  }, [bookingId, list]);

  useEffect(() => {
    if (!bookingId) {
      setDocuments([]);
      setOpenDoc(null);
      return;
    }
    void reload();
  }, [bookingId, reload]);

  // Closing the modal resets every step so the next open starts on the list.
  const close = useCallback(() => {
    setOpenDoc(null);
    setUploadOpen(false);
    setUploadTitle("");
    setUploadFile(null);
    setNotice(null);
    onClose();
  }, [onClose]);

  const doUpload = useCallback(async () => {
    if (!bookingId || !uploadFile) return;
    setUploading(true);
    setError(null);
    try {
      // Same caps the server enforces: bookingDocumentMaxUploadBytes for any
      // file, bookingDocumentMaxDocuments for the count, and a 10 MB INPUT cap
      // for images because the backend webp encoder refuses anything larger.
      if (uploadFile.size > BOOKING_DOCUMENT_MAX_BYTES) {
        throw new Error(`"${uploadFile.name}" supera el máximo de ${Math.round(BOOKING_DOCUMENT_MAX_BYTES / (1024 * 1024))} MB`);
      }
      if (uploadFile.type.startsWith("image/") && uploadFile.size > BOOKING_DOCUMENT_MAX_IMAGE_INPUT_BYTES) {
        throw new Error(
          `"${uploadFile.name}" supera el máximo de ${Math.round(BOOKING_DOCUMENT_MAX_IMAGE_INPUT_BYTES / (1024 * 1024))} MB para imágenes; comprímela antes de subirla`,
        );
      }
      if (documents.length >= BOOKING_DOCUMENT_MAX_DOCUMENTS) {
        throw new Error(`Esta reserva ya tiene el máximo de ${BOOKING_DOCUMENT_MAX_DOCUMENTS} documentos`);
      }
      const created = await upload(uploadFile, uploadTitle || uploadFile.name, bookingId);
      // Success is shown from the socket reply, not from the click.
      setNotice(`"${created.title || created.original_filename}" subido correctamente`);
      setUploadTitle("");
      setUploadFile(null);
      setUploadOpen(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir el documento");
    } finally {
      setUploading(false);
    }
  }, [bookingId, documents.length, reload, upload, uploadFile, uploadTitle]);

  const doDelete = useCallback(async () => {
    if (!bookingId || !deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await remove(deleteTarget.id);
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el documento");
    } finally {
      setDeleting(false);
    }
  }, [bookingId, deleteTarget, reload, remove]);

  const share = useCallback(async (doc: BookingDocument) => {
    const url = bookingDocumentAbsoluteUrl(doc);
    const payload = { title: doc.title || doc.original_filename, url };
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share(payload);
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Enlace copiado al portapapeles");
    } catch (e) {
      // A cancelled share sheet is not an error worth surfacing.
      if (e instanceof Error && e.name === "AbortError") return;
      setError("No se pudo compartir el documento");
    }
  }, []);

  const fade = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeOut" as const };

  return (
    <>
      <Modal
        open={bookingId != null}
        title="Documentos"
        onClose={close}
        widthPx={720}
        className="bo-bookingDocumentsModal"
        hideClose
      >
        <ModalHeader title="Documentos" onClose={close} />
        <div className="bo-bookingDocumentsBody" data-slot="booking-documents-body">
          <AnimatePresence mode="wait" initial={false}>
            {openDoc ? (
              <motion.div
                key={`preview-${openDoc.id}`}
                style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
                initial={reduceMotion ? { opacity: 1 } : { opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -16 }}
                transition={transition}
                data-slot="booking-documents-step-preview"
                data-testid="reservas-documents-step-preview"
              >
                <div className="bo-bookingDocumentsToolbar" data-slot="booking-documents-preview-toolbar">
                  <button
                    type="button"
                    className="bo-actionBtn"
                    onClick={() => setOpenDoc(null)}
                    aria-label="Volver a la lista"
                    title="Volver a la lista"
                    data-testid="reservas-documents-preview-back"
                  >
                    <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
                  </button>
                  <div className="bo-bookingDocumentsPreviewActions" data-slot="booking-documents-preview-actions">
                    <a
                      className="bo-btn bo-btn--ghost bo-btn--sm"
                      href={openDoc.url}
                      target="_blank"
                      rel="noreferrer"
                      data-testid="reservas-documents-preview-open"
                    >
                      <ExternalLink size={14} strokeWidth={1.8} aria-hidden="true" /> Ver página completa
                    </a>
                    <a
                      className="bo-btn bo-btn--ghost bo-btn--sm"
                      href={openDoc.url}
                      download={bookingDocumentDownloadName(openDoc)}
                      data-testid="reservas-documents-preview-download"
                    >
                      <Download size={14} strokeWidth={1.8} aria-hidden="true" /> Descargar
                    </a>
                    <button
                      type="button"
                      className="bo-btn bo-btn--ghost bo-btn--sm"
                      onClick={() => void share(openDoc)}
                      data-testid="reservas-documents-preview-share"
                    >
                      <Share2 size={14} strokeWidth={1.8} aria-hidden="true" /> Compartir
                    </button>
                  </div>
                </div>
                <h3 className="bo-bookingDocumentsPreviewTitle" data-testid="reservas-documents-preview-title">
                  {openDoc.title || openDoc.original_filename}
                </h3>
                <DocumentPreview doc={openDoc} />
              </motion.div>
            ) : (
              <motion.div
                key="list"
                style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}
                initial={fade.initial}
                animate={fade.animate}
                exit={fade.exit}
                transition={transition}
                data-slot="booking-documents-step-list"
                data-testid="reservas-documents-step-list"
              >
                {notice ? (
                  <InlineAlert kind="success" title="Listo" message={notice} testId="reservas-documents-notice" />
                ) : null}
                {error ? <InlineAlert kind="error" title="Error" message={error} testId="reservas-documents-error" /> : null}
                {loading && documents.length === 0 ? (
                  <p className="bo-muted" data-testid="reservas-documents-loading">Cargando documentos…</p>
                ) : null}
                {!loading && documents.length === 0 ? (
                  <p className="bo-muted" data-testid="reservas-documents-empty">
                    Esta reserva todavía no tiene documentos.
                  </p>
                ) : null}
                <div className="bo-bookingDocumentsList" data-testid="reservas-documents-list">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bo-bookingDocumentsItem" data-testid={`reservas-documents-item-${doc.id}`}>
                      <button
                        type="button"
                        className="bo-bookingDocumentsOpen"
                        onClick={() => setOpenDoc(doc)}
                        data-testid={`reservas-documents-open-${doc.id}`}
                      >
                        {doc.title || doc.original_filename}
                      </button>
                      <button
                        type="button"
                        className="bo-actionBtn"
                        onClick={() => setDeleteTarget(doc)}
                        aria-label={`Eliminar ${doc.title || doc.original_filename}`}
                        title="Eliminar documento"
                        data-testid={`reservas-documents-delete-${doc.id}`}
                      >
                        <Trash2 size={16} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <AnimatePresence initial={false}>
                  {uploadOpen ? (
                    <motion.div
                      key="upload"
                      style={{ display: "flex", flexDirection: "column", gap: 10 }}
                      {...fade}
                      transition={transition}
                      data-slot="booking-documents-upload"
                      data-testid="reservas-documents-upload"
                    >
                      <DocumentAttachmentField
                        index={0}
                        title={uploadTitle}
                        file={uploadFile}
                        busy={uploading}
                        state={uploading ? "uploading" : "idle"}
                        onTitleChange={setUploadTitle}
                        onFileChange={setUploadFile}
                        onRemove={() => setUploadFile(null)}
                        testId="reservas-documents-upload-row"
                      />
                      <div className="bo-modalActions" data-slot="booking-documents-upload-actions">
                        <button
                          type="button"
                          className="bo-btn bo-btn--ghost"
                          onClick={() => setUploadOpen(false)}
                          disabled={uploading}
                          data-testid="reservas-documents-upload-cancel"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="bo-btn bo-btn--primary"
                          onClick={() => void doUpload()}
                          disabled={uploading || !uploadFile}
                          data-testid="reservas-documents-upload-submit"
                        >
                          {uploading ? "Subiendo…" : "Subir documento"}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="upload-trigger"
                      type="button"
                      className="bo-btn bo-btn--primary bo-bookingDocumentsUploadBtn"
                      onClick={() => setUploadOpen(true)}
                      disabled={!connected}
                      title={connected ? "Subir un documento a esta reserva" : "Conectando con el servidor…"}
                      {...fade}
                      transition={transition}
                      data-testid="reservas-documents-upload-open"
                    >
                      <Upload size={16} strokeWidth={1.8} aria-hidden="true" /> Subir documento
                    </motion.button>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>

      {/* Second modal: nothing is deleted without an explicit confirmation. */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar documento"
        message={deleteTarget ? `¿Eliminar "${deleteTarget.title || deleteTarget.original_filename}" de la reserva?` : ""}
        confirmText="Eliminar"
        danger
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void doDelete()}
      />
    </>
  );
}
