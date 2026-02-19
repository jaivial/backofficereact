import React, { useState, useCallback } from "react";
import { X, File, Image, FileText, Download, Trash2, Archive, Loader2, Eye } from "lucide-react";
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
      <div className="bo-modalOverlay" onClick={onClose}>
        <div className="bo-modal bo-attachmentsModal" role="dialog" aria-label="Adjuntos de factura" onClick={(e) => e.stopPropagation()}>
          <div className="bo-attachmentsModalHeader">
            <h2 className="bo-attachmentsModalTitle">
              Adjuntos
              {invoiceNumber && <span className="bo-attachmentsModalSubtitle">Factura {invoiceNumber}</span>}
            </h2>
            <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>

          <div className="bo-attachmentsModalBody">
            {attachments.length === 0 ? (
              <div className="bo-attachmentsEmpty">
                <File size={48} className="bo-attachmentsEmptyIcon" />
                <p>No hay adjuntos</p>
              </div>
            ) : (
              <ul className="bo-attachmentsList">
                {attachments.map((attachment) => {
                  const FileIcon = getFileIcon(attachment.mime_type);
                  const iconColor = getFileIconColor(attachment.mime_type);

                  return (
                    <li key={attachment.id} className="bo-attachmentItem">
                      <div className="bo-attachmentIcon" style={{ color: iconColor }}>
                        <FileIcon size={24} />
                      </div>
                      <div className="bo-attachmentInfo">
                        <span className="bo-attachmentName" title={attachment.original_name}>
                          {attachment.original_name}
                        </span>
                        <span className="bo-attachmentMeta">
                          {formatFileSize(attachment.size)} • {attachment.mime_type}
                        </span>
                      </div>
                      <div className="bo-attachmentActions">
                        {isPreviewable(attachment.mime_type) && (
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            onClick={() => setPreviewingAttachment(attachment)}
                            title="Vista previa"
                            aria-label={`Vista previa de ${attachment.original_name}`}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          onClick={() => handleDownloadSingle(attachment)}
                          title="Descargar"
                          aria-label={`Descargar ${attachment.original_name}`}
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

          {attachments.length > 0 && (
            <div className="bo-attachmentsModalFooter">
              <span className="bo-attachmentsCount">
                {attachments.length} archivo{attachments.length !== 1 ? "s" : ""} adjunto{attachments.length !== 1 ? "s" : ""}
              </span>
              <button
                className="bo-btn bo-btn--primary bo-btn--sm"
                onClick={handleDownloadAll}
                disabled={downloadingAll}
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
        <div className="bo-modalOverlay" onClick={() => setPreviewingAttachment(null)}>
          <div className="bo-modal bo-previewModal" role="dialog" aria-label="Vista previa" onClick={(e) => e.stopPropagation()}>
            <div className="bo-previewModalHeader">
              <h3>{previewingAttachment.original_name}</h3>
              <button className="bo-btn bo-btn--ghost bo-btn--sm" onClick={() => setPreviewingAttachment(null)} aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <div className="bo-previewModalBody">
              {previewingAttachment.mime_type.startsWith("image/") ? (
                <img src={previewingAttachment.url} alt={previewingAttachment.original_name} className="bo-previewImage" />
              ) : previewingAttachment.mime_type === "application/pdf" ? (
                <iframe src={previewingAttachment.url} title={previewingAttachment.original_name} className="bo-previewPdf" />
              ) : null}
            </div>
            <div className="bo-previewModalFooter">
              <button className="bo-btn bo-btn--primary" onClick={() => handleDownloadSingle(previewingAttachment)}>
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
