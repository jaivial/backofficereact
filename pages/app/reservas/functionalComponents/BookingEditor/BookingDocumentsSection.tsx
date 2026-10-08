import React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";

import { Panel } from "../../../../../ui/shell/Panel";
import { Switch } from "../../../../../ui/shadcn/Switch";
import { DocumentAttachmentField } from "../BookingDocuments/DocumentAttachmentField";

/** One row of the booking-create document draft (a File + its editable title). */
export type BookingDocumentDraft = { title: string; file: File | null };

/**
 * "Adjuntar documento" section of the booking editor. Rows hold the picked
 * files; the parent uploads them over the socket and binds the returned draft
 * ids to the booking-create call.
 * Coordination id: booking_documents_v1
 */
export function BookingDocumentsSection({
  enabled,
  rows,
  sendToClient,
  busy,
  uploadingIndex,
  reduceMotion,
  onToggleEnabled,
  onToggleSendToClient,
  onRowChange,
  onAddRow,
  onRemoveRow,
}: {
  enabled: boolean;
  rows: BookingDocumentDraft[];
  sendToClient: boolean;
  busy?: boolean;
  /** Index of the row being uploaded, so its attachment shows the busy state. */
  uploadingIndex?: number | null;
  reduceMotion?: boolean;
  onToggleEnabled: (next: boolean) => void;
  onToggleSendToClient: (next: boolean) => void;
  onRowChange: (index: number, patch: Partial<BookingDocumentDraft>) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}) {
  const fade = reduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } };
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" as const };

  return (
    <Panel
      className="bo-bookingPanel--documents"
      data-slot="bookingEditor-panel"
      data-testid="booking-editor-documents-panel"
      title="Adjuntar documento"
      meta={enabled ? `${rows.length}` : "No"}
    >
      <div className="bo-chips bo-bookingBinaryChips" role="group" aria-label="¿Adjuntar documento?" data-slot="booking-editor-documents-toggle">
        <button
          type="button"
          className={`bo-chip${enabled ? "" : " is-on"}`}
          onClick={() => onToggleEnabled(false)}
          disabled={busy}
          data-slot="booking-editor-documents-no"
          data-testid="booking-editor-documents-no"
        >
          No
        </button>
        <button
          type="button"
          className={`bo-chip${enabled ? " is-on" : ""}`}
          onClick={() => onToggleEnabled(true)}
          disabled={busy}
          data-slot="booking-editor-documents-yes"
          data-testid="booking-editor-documents-yes"
        >
          Sí
        </button>
      </div>

      <AnimatePresence initial={false}>
        {enabled ? (
          <motion.div
            key="documents-content"
            style={{ marginTop: 12, display: "grid", gap: 14 }}
            {...fade}
            transition={transition}
            data-slot="booking-editor-documents-content"
            data-testid="booking-editor-documents-content"
          >
            <label className="bo-bookingDocumentsSendToggle" data-slot="booking-editor-documents-send-toggle-label">
              <span className="bo-bookingDocumentsSendCopy" data-slot="booking-editor-documents-send-toggle-copy">
                <span className="bo-bookingDocumentsSendTitle" data-testid="booking-editor-documents-send-title">
                  Enviar copia al cliente
                </span>
                <span className="bo-bookingDocumentsSendText" data-testid="booking-editor-documents-send-text">
                  Enviaremos una copia del documento en la confirmación de la reserva mediante email y WhatsApp
                </span>
              </span>
              <Switch
                checked={sendToClient}
                onCheckedChange={onToggleSendToClient}
                disabled={busy}
                aria-label="Enviar copia al cliente"
                data-testid="booking-editor-documents-send-toggle"
              />
            </label>

            <div className="bo-bookingDocumentsRows" data-slot="booking-editor-documents-rows" data-testid="booking-editor-documents-rows">
              {rows.map((row, index) => (
                <DocumentAttachmentField
                  key={index}
                  index={index}
                  title={row.title}
                  file={row.file}
                  busy={busy || uploadingIndex === index}
                  disabled={busy}
                  state={uploadingIndex === index ? "uploading" : "done"}
                  onTitleChange={(title) => onRowChange(index, { title })}
                  onFileChange={(file) => onRowChange(index, { file })}
                  onRemove={() => onRemoveRow(index)}
                  testId="booking-editor-document"
                />
              ))}
            </div>

            <button
              type="button"
              className="bo-btn bo-btn--ghost bo-btn--sm"
              onClick={onAddRow}
              disabled={busy}
              data-slot="booking-editor-add-document"
              data-testid="booking-editor-documents-add"
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden="true" /> Añadir
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Panel>
  );
}
