import React from "react";
import { X, FileDown, PencilLine, Calendar, User, Mail, Phone, MapPin, CreditCard, Send } from "lucide-react";
import { Modal } from "../../../../ui/overlays/Modal";
import type { Invoice, InvoiceStatus } from "../../../../api/types";

type InvoicePreviewModalProps = {
  invoice: Invoice;
  onClose: () => void;
  onEdit: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
};

const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bo-badge--muted" },
  solicitada: { label: "Solicitada", className: "bo-badge--warning" },
  pendiente: { label: "Pendiente", className: "bo-badge--info" },
  enviada: { label: "Enviada", className: "bo-badge--success" },
  pagada: { label: "Pagada", className: "bo-badge--success" },
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  bizum: "Bizum",
  cheque: "Cheque",
};

function formatPrice(price: number): string {
  return `${price.toFixed(2)} €`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoicePreviewModal({ invoice, onClose, onEdit, onDownloadPdf, onSendEmail }: InvoicePreviewModalProps) {
  const handleEdit = () => {
    onEdit(invoice);
    onClose();
  };

  const handleDownloadPdf = () => {
    onDownloadPdf(invoice);
  };

  const statusConfig = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, className: "" };

  // Build full address
  const fullAddress = [
    invoice.customer_address_street,
    invoice.customer_address_number,
    invoice.customer_address_postal_code,
    invoice.customer_address_city,
    invoice.customer_address_province,
    invoice.customer_address_country,
  ].filter(Boolean).join(", ");

  return (
    <Modal open={true} title={`Vista previa de factura ${invoice.invoice_number || invoice.id}`} onClose={onClose} widthPx={700}>
      <div data-testid="invoice-preview-container" className="bo-invoicePreview" data-slot="invoice-preview-container">
        {/* Header Actions */}
        <div data-testid="invoice-preview-actions" className="bo-invoicePreviewActions" data-slot="invoice-preview-actions">
          <button
            className="bo-btn bo-btn--primary"
            type="button"
            onClick={handleDownloadPdf}
            disabled={!invoice.pdf_url}
            data-testid="invoice-preview-modal-download-pdf-btn"
          >
            <FileDown size={16} />
            Descargar PDF
          </button>
          {invoice.customer_email && (
            <button
              className="bo-btn bo-btn--secondary"
              type="button"
              onClick={() => onSendEmail(invoice)}
              data-testid="invoice-preview-modal-send-email-btn"
            >
              <Send size={16} />
              {invoice.status === "enviada" ? "Reenviar email" : "Enviar email"}
            </button>
          )}
          <button
            className="bo-btn bo-btn--secondary"
            type="button"
            onClick={handleEdit}
            data-testid="invoice-preview-modal-edit-btn"
          >
            <PencilLine size={16} />
            Editar
          </button>
        </div>

        {/* Invoice Header */}
        <div data-testid="invoice-preview-header" className="bo-invoicePreviewHeader" data-slot="invoice-preview-header">
          <div data-testid="invoice-preview-title" className="bo-invoicePreviewTitle" data-slot="invoice-preview-title">
            <h2 data-testid="invoicePreviewModal-ura" data-slot="invoicePreviewModal-ura">Factura</h2>
            <span data-testid="invoicePreviewModal-invoiceNumber" className="bo-invoiceNumber" data-slot="invoicePreviewModal-invoiceNumber">{invoice.invoice_number || `N. ${invoice.id}`}</span>
          </div>
          <div data-testid="invoice-preview-status" className="bo-invoicePreviewStatus" data-slot="invoice-preview-status">
            <span data-testid="invoicePreviewModal-bel" className={`bo-badge ${statusConfig.className}`} data-slot="invoicePreviewModal-bel">{statusConfig.label}</span>
            {invoice.is_reservation && (
              <span data-testid="invoicePreviewModal-badge-info" className="bo-badge bo-badge--info" data-slot="invoicePreviewModal-badge--info">Reserva</span>
            )}
          </div>
        </div>

        {/* Invoice Details Grid */}
        <div data-testid="invoice-preview-grid" className="bo-invoicePreviewGrid" data-slot="invoice-preview-grid">
          {/* Dates Column */}
          <div data-testid="invoice-preview-section-dates" className="bo-invoicePreviewSection" data-slot="invoice-preview-section-dates">
            <h3 data-testid="invoicePreviewModal-invoicePreviewSectionTitle" className="bo-invoicePreviewSectionTitle" data-slot="invoicePreviewModal-invoicePreviewSectionTitle">
              <Calendar size={14} />
              Fechas
            </h3>
            <div data-testid="invoicePreviewModal-invoicePreviewField" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
              <span data-testid="invoicePreviewModal-invoicePreviewLabel" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Fecha de factura</span>
              <span data-testid="invoicePreviewModal-invoicePreviewValue" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{formatDate(invoice.invoice_date)}</span>
            </div>
            {invoice.payment_date && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-2" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-2" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Fecha de pago</span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-2" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{formatDate(invoice.payment_date)}</span>
              </div>
            )}
            {invoice.is_reservation && invoice.reservation_date && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-3" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-3" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Fecha de reserva</span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-3" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{formatDate(invoice.reservation_date)}</span>
              </div>
            )}
          </div>

          {/* Customer Column */}
          <div data-testid="invoice-preview-section-customer" className="bo-invoicePreviewSection" data-slot="invoice-preview-section-customer">
            <h3 data-testid="invoicePreviewModal-invoicePreviewSectionTitle-2" className="bo-invoicePreviewSectionTitle" data-slot="invoicePreviewModal-invoicePreviewSectionTitle">
              <User size={14} />
              Cliente
            </h3>
            <div data-testid="invoicePreviewModal-invoicePreviewField-4" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
              <span data-testid="invoicePreviewModal-invoicePreviewLabel-4" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Nombre</span>
              <span data-testid="invoicePreviewModal-invoicePreviewValue-4" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">
                {invoice.customer_name} {invoice.customer_surname}
              </span>
            </div>
            {invoice.customer_dni_cif && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-5" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-5" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">DNI/CIF</span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-5" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{invoice.customer_dni_cif}</span>
              </div>
            )}
            <div data-testid="invoicePreviewModal-invoicePreviewField-6" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
              <span data-testid="invoicePreviewModal-invoicePreviewLabel-6" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">
                <Mail size={12} />
                Email
              </span>
              <span data-testid="invoicePreviewModal-invoicePreviewValue-6" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{invoice.customer_email}</span>
            </div>
            {invoice.customer_phone && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-7" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-7" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">
                  <Phone size={12} />
                  Teléfono
                </span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-7" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{invoice.customer_phone}</span>
              </div>
            )}
            {fullAddress && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-8" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-8" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">
                  <MapPin size={12} />
                  Dirección
                </span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-8" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{fullAddress}</span>
              </div>
            )}
          </div>

          {/* Payment Column */}
          <div data-testid="invoice-preview-section-payment" className="bo-invoicePreviewSection" data-slot="invoice-preview-section-payment">
            <h3 data-testid="invoicePreviewModal-invoicePreviewSectionTitle-3" className="bo-invoicePreviewSectionTitle" data-slot="invoicePreviewModal-invoicePreviewSectionTitle">
              <CreditCard size={14} />
              Pago
            </h3>
            {invoice.payment_method && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-9" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-9" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Método de pago</span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-9" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">
                  {PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method}
                </span>
              </div>
            )}
            {invoice.is_reservation && invoice.reservation_party_size && (
              <div data-testid="invoicePreviewModal-invoicePreviewField-10" className="bo-invoicePreviewField" data-slot="invoicePreviewModal-invoicePreviewField">
                <span data-testid="invoicePreviewModal-invoicePreviewLabel-10" className="bo-invoicePreviewLabel" data-slot="invoicePreviewModal-invoicePreviewLabel">Comensales</span>
                <span data-testid="invoicePreviewModal-invoicePreviewValue-10" className="bo-invoicePreviewValue" data-slot="invoicePreviewModal-invoicePreviewValue">{invoice.reservation_party_size}</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div data-testid="invoice-preview-totals" className="bo-invoicePreviewTotals" data-slot="invoice-preview-totals">
          <div data-testid="invoicePreviewModal-invoicePreviewTotalRow" className="bo-invoicePreviewTotalRow" data-slot="invoicePreviewModal-invoicePreviewTotalRow">
            <span data-testid="invoicePreviewModal-invoicePreviewTotalLabel" className="bo-invoicePreviewTotalLabel" data-slot="invoicePreviewModal-invoicePreviewTotalLabel">Base imponible</span>
            <span data-testid="invoicePreviewModal-invoicePreviewTotalValue" className="bo-invoicePreviewTotalValue" data-slot="invoicePreviewModal-invoicePreviewTotalValue">{formatPrice(invoice.amount)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div data-testid="invoicePreviewModal-invoicePreviewTotalRow-2" className="bo-invoicePreviewTotalRow" data-slot="invoicePreviewModal-invoicePreviewTotalRow">
              <span data-testid="invoicePreviewModal-invoicePreviewTotalLabel-2" className="bo-invoicePreviewTotalLabel" data-slot="invoicePreviewModal-invoicePreviewTotalLabel">IVA ({invoice.iva_rate}%)</span>
              <span data-testid="invoicePreviewModal-invoicePreviewTotalValue-2" className="bo-invoicePreviewTotalValue" data-slot="invoicePreviewModal-invoicePreviewTotalValue">{formatPrice(invoice.iva_amount || 0)}</span>
            </div>
          )}
          <div data-testid="invoicePreviewModal-invoicePreviewTotalRow-final" className="bo-invoicePreviewTotalRow bo-invoicePreviewTotalRow--final" data-slot="invoicePreviewModal-invoicePreviewTotalRow--final">
            <span data-testid="invoicePreviewModal-invoicePreviewTotalLabel-3" className="bo-invoicePreviewTotalLabel" data-slot="invoicePreviewModal-invoicePreviewTotalLabel">Total</span>
            <span data-testid="invoicePreviewModal-invoicePreviewTotalValue-3" className="bo-invoicePreviewTotalValue" data-slot="invoicePreviewModal-invoicePreviewTotalValue">{formatPrice(invoice.total || invoice.amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div data-testid="invoice-preview-footer" className="bo-invoicePreviewFooter" data-slot="invoice-preview-footer">
          <span data-testid="invoicePreviewModal-invoicePreviewId" className="bo-invoicePreviewId" data-slot="invoicePreviewModal-invoicePreviewId">ID: {invoice.id}</span>
          <span data-testid="invoicePreviewModal-invoicePreviewCreated" className="bo-invoicePreviewCreated" data-slot="invoicePreviewModal-invoicePreviewCreated">
            Creada: {formatDate(invoice.created_at)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
