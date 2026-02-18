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

export function InvoicePreviewModal({ invoice, onClose, onEdit, onDownloadPdf }: InvoicePreviewModalProps) {
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
      <div className="bo-invoicePreview">
        {/* Header Actions */}
        <div className="bo-invoicePreviewActions">
          <button
            className="bo-btn bo-btn--primary"
            type="button"
            onClick={handleDownloadPdf}
            disabled={!invoice.pdf_url}
          >
            <FileDown size={16} />
            Descargar PDF
          </button>
          {invoice.customer_email && (
            <button
              className="bo-btn bo-btn--secondary"
              type="button"
              onClick={() => onSendEmail(invoice)}
            >
              <Send size={16} />
              {invoice.status === "enviada" ? "Reenviar email" : "Enviar email"}
            </button>
          )}
          <button
            className="bo-btn bo-btn--secondary"
            type="button"
            onClick={handleEdit}
          >
            <PencilLine size={16} />
            Editar
          </button>
        </div>

        {/* Invoice Header */}
        <div className="bo-invoicePreviewHeader">
          <div className="bo-invoicePreviewTitle">
            <h2>Factura</h2>
            <span className="bo-invoiceNumber">{invoice.invoice_number || `N. ${invoice.id}`}</span>
          </div>
          <div className="bo-invoicePreviewStatus">
            <span className={`bo-badge ${statusConfig.className}`}>{statusConfig.label}</span>
            {invoice.is_reservation && (
              <span className="bo-badge bo-badge--info">Reserva</span>
            )}
          </div>
        </div>

        {/* Invoice Details Grid */}
        <div className="bo-invoicePreviewGrid">
          {/* Dates Column */}
          <div className="bo-invoicePreviewSection">
            <h3 className="bo-invoicePreviewSectionTitle">
              <Calendar size={14} />
              Fechas
            </h3>
            <div className="bo-invoicePreviewField">
              <span className="bo-invoicePreviewLabel">Fecha de factura</span>
              <span className="bo-invoicePreviewValue">{formatDate(invoice.invoice_date)}</span>
            </div>
            {invoice.payment_date && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">Fecha de pago</span>
                <span className="bo-invoicePreviewValue">{formatDate(invoice.payment_date)}</span>
              </div>
            )}
            {invoice.is_reservation && invoice.reservation_date && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">Fecha de reserva</span>
                <span className="bo-invoicePreviewValue">{formatDate(invoice.reservation_date)}</span>
              </div>
            )}
          </div>

          {/* Customer Column */}
          <div className="bo-invoicePreviewSection">
            <h3 className="bo-invoicePreviewSectionTitle">
              <User size={14} />
              Cliente
            </h3>
            <div className="bo-invoicePreviewField">
              <span className="bo-invoicePreviewLabel">Nombre</span>
              <span className="bo-invoicePreviewValue">
                {invoice.customer_name} {invoice.customer_surname}
              </span>
            </div>
            {invoice.customer_dni_cif && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">DNI/CIF</span>
                <span className="bo-invoicePreviewValue">{invoice.customer_dni_cif}</span>
              </div>
            )}
            <div className="bo-invoicePreviewField">
              <span className="bo-invoicePreviewLabel">
                <Mail size={12} />
                Email
              </span>
              <span className="bo-invoicePreviewValue">{invoice.customer_email}</span>
            </div>
            {invoice.customer_phone && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">
                  <Phone size={12} />
                  Teléfono
                </span>
                <span className="bo-invoicePreviewValue">{invoice.customer_phone}</span>
              </div>
            )}
            {fullAddress && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">
                  <MapPin size={12} />
                  Dirección
                </span>
                <span className="bo-invoicePreviewValue">{fullAddress}</span>
              </div>
            )}
          </div>

          {/* Payment Column */}
          <div className="bo-invoicePreviewSection">
            <h3 className="bo-invoicePreviewSectionTitle">
              <CreditCard size={14} />
              Pago
            </h3>
            {invoice.payment_method && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">Método de pago</span>
                <span className="bo-invoicePreviewValue">
                  {PAYMENT_METHOD_LABELS[invoice.payment_method] || invoice.payment_method}
                </span>
              </div>
            )}
            {invoice.is_reservation && invoice.reservation_party_size && (
              <div className="bo-invoicePreviewField">
                <span className="bo-invoicePreviewLabel">Comensales</span>
                <span className="bo-invoicePreviewValue">{invoice.reservation_party_size}</span>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bo-invoicePreviewTotals">
          <div className="bo-invoicePreviewTotalRow">
            <span className="bo-invoicePreviewTotalLabel">Base imponible</span>
            <span className="bo-invoicePreviewTotalValue">{formatPrice(invoice.amount)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div className="bo-invoicePreviewTotalRow">
              <span className="bo-invoicePreviewTotalLabel">IVA ({invoice.iva_rate}%)</span>
              <span className="bo-invoicePreviewTotalValue">{formatPrice(invoice.iva_amount || 0)}</span>
            </div>
          )}
          <div className="bo-invoicePreviewTotalRow bo-invoicePreviewTotalRow--final">
            <span className="bo-invoicePreviewTotalLabel">Total</span>
            <span className="bo-invoicePreviewTotalValue">{formatPrice(invoice.total || invoice.amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bo-invoicePreviewFooter">
          <span className="bo-invoicePreviewId">ID: {invoice.id}</span>
          <span className="bo-invoicePreviewCreated">
            Creada: {formatDate(invoice.created_at)}
          </span>
        </div>
      </div>
    </Modal>
  );
}
