import React, { useEffect, useState, useCallback } from "react";
import { Eye, Send, Edit3, Loader2, AlertCircle, Download, FileText } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";

type InvoicePdfPreviewModalProps = {
  invoiceData: {
    id?: number;
    invoice_number?: string;
    customer_name: string;
    customer_email: string;
    amount: number;
    iva_rate?: number;
    iva_amount?: number;
    total?: number;
    currency?: string;
    invoice_date: string;
    due_date?: string;
    payment_method?: string;
    status?: string;
    pdf_template?: string;
    [key: string]: any;
  };
  onClose: () => void;
  onEdit: () => void;
  onConfirmSend: () => void;
  isSending?: boolean;
  backendOrigin?: string;
};

export function InvoicePdfPreviewModal({
  invoiceData,
  onClose,
  onEdit,
  onConfirmSend,
  isSending = false,
  backendOrigin = "",
}: InvoicePdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);

  const hasInvoiceId = !!invoiceData.id;

  // Generate the PDF URL when invoice ID is available
  useEffect(() => {
    if (!hasInvoiceId) {
      setLoading(false);
      setError("La factura debe guardarse primero para ver la vista previa del PDF.");
      setPdfReady(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPdfReady(false);

    // For existing invoices, use the PDF endpoint
    const url = `${backendOrigin}/api/admin/invoices/${invoiceData.id}/pdf`;
    setPdfUrl(url);
  }, [invoiceData.id, backendOrigin, hasInvoiceId]);

  // Handle PDF load
  const handleLoad = useCallback(() => {
    setLoading(false);
    setPdfReady(true);
  }, []);

  // Handle PDF error
  const handleError = useCallback(() => {
    setLoading(false);
    setError("No se pudo cargar la vista previa del PDF. Por favor, asegurese de que la factura este guardada.");
  }, []);

  // Retry loading PDF
  const retryLoadPdf = useCallback(() => {
    if (!invoiceData.id) return;

    setLoading(true);
    setError(null);
    setPdfUrl(`${backendOrigin}/api/admin/invoices/${invoiceData.id}/pdf?t=${Date.now()}`);
  }, [invoiceData.id, backendOrigin]);

  // Format currency for display
  const formatPrice = (price: number, currency: string = "EUR") => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency,
    }).format(price);
  };

  return (
    <Modal open={true} title="Vista previa de factura" onClose={onClose} widthPx={800} className="bo-pdf-preview-modal">
      <div className="bo-pdf-preview">
        {/* Header Actions */}
        <div className="bo-pdf-preview-header">
          <div className="bo-pdf-preview-info">
            <span className="bo-pdf-preview-number">
              {invoiceData.invoice_number || `Nueva Factura`}
            </span>
            <span className="bo-pdf-preview-customer">
              {invoiceData.customer_name}
            </span>
          </div>
          <div className="bo-pdf-preview-actions">
            {pdfReady && pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bo-btn bo-btn--secondary bo-btn--sm"
                download
              >
                <Download size={14} />
                Descargar
              </a>
            )}
            <button
              type="button"
              className="bo-btn bo-btn--secondary bo-btn--sm"
              onClick={onEdit}
              disabled={isSending}
            >
              <Edit3 size={14} />
              Editar
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="bo-pdf-preview-viewer">
          {loading && (
            <div className="bo-pdf-preview-loading">
              <Loader2 size={32} className="bo-spinner" />
              <p>Cargando vista previa...</p>
              {!hasInvoiceId && (
                <p className="bo-pdf-preview-hint">
                  Guardando la factura primero...
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="bo-pdf-preview-error">
              <FileText size={48} />
              <p>{error}</p>
              {hasInvoiceId && (
                <button
                  type="button"
                  className="bo-btn bo-btn--primary"
                  onClick={retryLoadPdf}
                >
                  Reintentar
                </button>
              )}
              <button
                type="button"
                className="bo-btn bo-btn--secondary"
                onClick={onEdit}
              >
                Volver a editar
              </button>
            </div>
          )}

          {!loading && !error && pdfUrl && (
            <iframe
              src={pdfUrl}
              className="bo-pdf-preview-iframe"
              onLoad={handleLoad}
              onError={handleError}
              title="Vista previa del PDF"
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="bo-pdf-preview-footer">
          <div className="bo-pdf-preview-summary">
            <span className="bo-pdf-preview-total">
              Total: {formatPrice(invoiceData.total || invoiceData.amount, invoiceData.currency)}
            </span>
            {!hasInvoiceId && (
              <span className="bo-pdf-preview-hint-text">
                La factura se guardara al hacer clic en &quot;Vista previa&quot;
              </span>
            )}
          </div>
          <div className="bo-pdf-preview-footer-actions">
            <button
              type="button"
              className="bo-btn bo-btn--secondary"
              onClick={onEdit}
              disabled={isSending}
            >
              <Edit3 size={16} />
              Volver a editar
            </button>
            <button
              type="button"
              className="bo-btn bo-btn--primary"
              onClick={onConfirmSend}
              disabled={isSending || !hasInvoiceId}
              title={!hasInvoiceId ? "Guarde la factura primero" : "Enviar factura"}
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="bo-spinner" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Confirmar y enviar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
