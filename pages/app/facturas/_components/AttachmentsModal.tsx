import React, { useState, useCallback } from "react";
import { X, File, Image, FileText, Download, Trash2, Archive, Loader2, Eye } from "lucide-react";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
import type { InvoiceAttachment } from "../../../../api/types";

type AttachmentsModalProps = {
  open: boolean;
  onClose: () => void;
  attachments: InvoiceAttachment[];
  invoiceNumber?: string;
  onRemoveAttachment?: (attachmentId: number) => void;
  onDownloadAll?: (attachments: InvoiceAttachment[]) => void;
  isRemoving?: boolean;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  return File;
}

function getFileIconColor(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "var(--bo-color-info)";
  if (mimeType === "application/pdf") return "var(--bo-color-danger)";
  return "var(--bo-color-muted)";
}

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

export function AttachmentsModal({
  open,
  onClose,
  attachments,
  invoiceNumber,
  onRemoveAttachment,
  onDownloadAll,
  isRemoving = false,
}: AttachmentsModalProps) {
  const [previewingAttachment, setPreviewingAttachment] = useState<InvoiceAttachment | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownloadSingle = useCallback((attachment: InvoiceAttachment) => {
    window.open(attachment.url, "_blank");
  }, []);

  const handleDownloadAll = useCallback(async () => {
    if (!onDownloadAll || attachments.length === 0) {
      // Fallback: download each file individually
      for (const attachment of attachments) {
        window.open(attachment.url, "_blank");
      }
      return;
    }

    setDownloadingAll(true);
    try {
      await onDownloadAll(attachments);
    } finally {
      setDownloadingAll(false);
    }
  }, [attachments, onDownloadAll]);

  if (!open) return null;

  return (
    <>
      <div className="bo-modalOverlay" onClick={onClose} data-slot="attachmentsModal-modalOverlay">
        <div className="bo-modal bo-attachmentsModal" role="dialog" aria-label="Adjuntos de factura" onClick={(e) => e.stopPropagation()} data-slot="attachmentsModal-adjuntos-de-factura">
          <div className="bo-attachmentsModalHeader" data-slot="attachments-modal-header">
            <h2 className="bo-attachmentsModalTitle" data-slot="attachments-modal-title">
              Adjuntos
              {invoiceNumber && <span className="bo-attachmentsModalSubtitle">Factura {invoiceNumber}</span>}
            </h2>
            <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onClose} aria-label="Cerrar" data-testid="attachments-close-button">
              <X size={18} />
            </button>
          </div>

          <ScrollArea dataSlot="attachments-modal-body">
            <div data-slot="attachmentsModal-attachmentsModalBody" className="bo-attachmentsModalBody">
            {attachments.length === 0 ? (
              <div className="bo-attachmentsEmpty" data-slot="attachments-empty">
                <File size={48} className="bo-attachmentsEmptyIcon" />
                <p data-slot="attachments-empty-text">No hay adjuntos</p>
              </div>
            ) : (
              <ul className="bo-attachmentsList" data-slot="attachmentsModal-attachmentsList">
                {attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.mime_type);
                  const iconColor = getFileIconColor(attachment.mime_type);

                  return (
                    <li key={attachment.id} className="bo-attachmentItem" data-slot="attachment-item">
                      <div className="bo-attachmentIcon" style={{ color: iconColor }} data-slot="attachment-icon">
                        <FileIcon size={24} />
                      </div>
                      <div className="bo-attachmentInfo" data-slot="attachment-info">
                        <span className="bo-attachmentName" data-slot="attachment-name" title={attachment.original_name}>
                          {attachment.original_name}
                        </span>
                        <span className="bo-attachmentMeta" data-slot="attachment-meta">
                          {formatFileSize(attachment.size)} • {attachment.mime_type}
                        </span>
                      </div>
                      <div className="bo-attachmentActions" data-slot="attachment-actions">
                        {isPreviewable(attachment.mime_type) && (
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            onClick={() => setPreviewingAttachment(attachment)}
                            title="Vista previa"
                            aria-label={`Vista previa de ${attachment.original_name}`}
                            data-testid={`attachments-preview-button-${attachment.id}`}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleDownloadSingle(attachment)}
                          title="Descargar"
                          aria-label={`Descargar ${attachment.original_name}`}
                          data-testid={`attachments-download-button-${attachment.id}`}
                        >
                          <Download size={16} />
                        </button>
                        {onRemoveAttachment && (
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--danger"
                            onClick={() => onRemoveAttachment(attachment.id)}
                            disabled={isRemoving}
                            title="Eliminar"
                            aria-label={`Eliminar ${attachment.original_name}`}
                            data-testid={`attachments-remove-button-${attachment.id}`}
                          >
                            {isRemoving ? <Loader2 size={16} className="bo-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          </ScrollArea>

          {attachments.length > 0 && (
            <div className="bo-attachmentsModalFooter" data-slot="attachments-modal-footer">
              <span className="bo-attachmentsCount" data-slot="attachments-count">
                {attachments.length} archivo{attachments.length !== 1 ? "s" : ""} adjunto{attachments.length !== 1 ? "s" : ""}
              </span>
              <button
                className="bo-btn bo-btn--primary bo-btn--sm"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
                data-testid="attachments-download-all-button"
              >
                {downloadingAll ? (
                  <>
                    <Loader2 size={16} className="bo-spin" />
                    Descargando...
                  </>
                ) : (
                  <>
                    <Archive size={16} />
                    Descargar todo (ZIP)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewingAttachment && (
        <div className="bo-modalOverlay" onClick={() => setPreviewingAttachment(null)} data-slot="attachmentsModal-modalOverlay">
          <div className="bo-modal bo-previewModal" role="dialog" aria-label="Vista previa" onClick={(e) => e.stopPropagation()} data-slot="attachmentsModal-vista-previa">
            <div className="bo-previewModalHeader" data-slot="preview-modal-header">
              <h3 data-slot="preview-modal-title">{previewingAttachment.original_name}</h3>
              <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setPreviewingAttachment(null)} aria-label="Cerrar" data-testid="attachments-preview-close-button">
                <X size={18} />
              </button>
            </div>
            <ScrollArea dataSlot="preview-modal-body">
              <div data-slot="attachmentsModal-previewModalBody" className="bo-previewModalBody">
              {previewingAttachment.mime_type.startsWith("image/") ? (
                <img src={previewingAttachment.url} alt={previewingAttachment.original_name} className="bo-previewImage" />
              ) : previewingAttachment.mime_type === "application/pdf" ? (
                <iframe src={previewingAttachment.url} title={previewingAttachment.original_name} className="bo-previewPdf" />
              ) : null}
            </div>
            </ScrollArea>
            <div className="bo-previewModalFooter" data-slot="preview-modal-footer">
              <button className="bo-btn bo-btn--primary" onClick={() => handleDownloadSingle(previewingAttachment)} data-testid="attachments-preview-download-button">
                <Download size={16} />
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
