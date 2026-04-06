import React, { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Download, FileText, Calendar, User, Mail, Phone, MapPin, CreditCard, AlertCircle, Clock } from "lucide-react";
import type { Data } from "./+data";
import {
  formatPrice,
  formatDate,
  formatDateShort,
  getStatusBadge,
  getPaymentStatusInfo,
} from "./helpers/factura.helpers";

export default function Page() {
  const pageContext = usePageContext();
  const { invoice, error, backendOrigin } = pageContext.data as Data;

  const pdfUrl = useMemo(() => {
    if (!invoice?.id) return null;
    return `${backendOrigin}/api/public/invoices/${invoice.id}/pdf`;
  }, [invoice?.id, backendOrigin]);

  if (error) {
    return (
      <div className="bo-publicInvoice" data-ui="invoice-error">
        <div className="bo-publicInvoiceError">
          <div className="bo-publicInvoiceErrorIcon">
            <AlertCircle size={48} />
          </div>
          <h1 data-ui="error-title">Error</h1>
          <p data-ui="error-message">{error}</p>
          <p className="bo-publicInvoiceErrorHint">
            Por favor, contacte con nosotros si cree que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="bo-publicInvoice" data-ui="invoice-loading">
        <div className="bo-publicInvoiceLoading">
          <div className="bo-spinner" />
          <p>Cargando factura...</p>
        </div>
      </div>
    );
  }

  const paymentInfo = getPaymentStatusInfo(invoice);
  const total = invoice.total || invoice.amount;
  const currency = invoice.currency || "EUR";

  return (
    <div className="bo-publicInvoice">
      <div className="bo-publicInvoiceContainer">
        {/* Header */}
        <div className="bo-publicInvoiceHeader" data-slot="invoice-header">
          <div className="bo-publicInvoiceBrand">
            <h1 data-ui="brand-name">Villa Carmen</h1>
            <p data-ui="brand-subtitle">Restaurante</p>
          </div>
          <div className="bo-publicInvoiceTitle">
            <h2 data-ui="invoice-title">Factura</h2>
            <p className="bo-publicInvoiceNumber" data-ui="invoice-number">{invoice.invoice_number || `#${invoice.id}`}</p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="bo-publicInvoiceStatusBar" data-slot="status-bar">
          <div className="bo-publicInvoiceStatus" data-slot="status-badge">
            {getStatusBadge(invoice.status)}
          </div>
          {pdfUrl && (
            <a href={pdfUrl} className="bo-btn bo-btn--primary" target="_blank" rel="noopener noreferrer" data-ui="download-pdf-btn">
              <Download size={16} />
              Descargar PDF
            </a>
          )}
        </div>

        {/* Payment Status */}
        <div className={`bo-paymentStatus ${paymentInfo.className}`} data-ui="payment-status">
          <div className="bo-paymentStatusInfo">
            <strong data-slot="payment-label">{paymentInfo.label}</strong>
            <span data-slot="payment-description">{paymentInfo.description}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bo-publicInvoiceSection" data-slot="customer-section">
          <h3 data-ui="section-title-customer">Cliente</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField" data-slot="field-name">
              <User size={16} />
              <div>
                <label>Nombre</label>
                <p>
                  {invoice.customer_name}
                  {invoice.customer_surname && ` ${invoice.customer_surname}`}
                </p>
              </div>
            </div>
            {invoice.customer_dni_cif && (
              <div className="bo-publicInvoiceField" data-slot="field-dni">
                <FileText size={16} />
                <div>
                  <label>DNI/CIF</label>
                  <p>{invoice.customer_dni_cif}</p>
                </div>
              </div>
            )}
            {invoice.customer_email && (
              <div className="bo-publicInvoiceField" data-slot="field-email">
                <Mail size={16} />
                <div>
                  <label>Email</label>
                  <p>{invoice.customer_email}</p>
                </div>
              </div>
            )}
            {invoice.customer_phone && (
              <div className="bo-publicInvoiceField" data-slot="field-phone">
                <Phone size={16} />
                <div>
                  <label>Teléfono</label>
                  <p>{invoice.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
          {(invoice.customer_address_street || invoice.customer_address_city) && (
            <div className="bo-publicInvoiceField bo-publicInvoiceField--full" data-slot="field-address">
              <MapPin size={16} />
              <div>
                <label>Dirección</label>
                <p>
                  {[invoice.customer_address_street, invoice.customer_address_number]
                    .filter(Boolean)
                    .join(", ")}
                  {invoice.customer_address_postal_code && `, ${invoice.customer_address_postal_code}`}
                  {invoice.customer_address_city && `, ${invoice.customer_address_city}`}
                  {invoice.customer_address_province && ` (${invoice.customer_address_province})`}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Invoice Details */}
        <div className="bo-publicInvoiceSection" data-slot="invoice-details-section">
          <h3 data-ui="section-title-details">Detalles de la Factura</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField" data-slot="field-invoice-date">
              <Calendar size={16} />
              <div>
                <label>Fecha de Factura</label>
                <p>{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            {invoice.payment_date && (
              <div className="bo-publicInvoiceField" data-slot="field-payment-date">
                <Calendar size={16} />
                <div>
                  <label>Fecha de Pago</label>
                  <p>{formatDate(invoice.payment_date)}</p>
                </div>
              </div>
            )}
            {invoice.payment_method && (
              <div className="bo-publicInvoiceField" data-slot="field-payment-method">
                <CreditCard size={16} />
                <div>
                  <label>Método de Pago</label>
                  <p style={{ textTransform: "capitalize" }}>{invoice.payment_method}</p>
                </div>
              </div>
            )}
            {invoice.reservation_date && (
              <div className="bo-publicInvoiceField" data-slot="field-reservation-date">
                <Calendar size={16} />
                <div>
                  <label>Fecha de Reserva</label>
                  <p>
                    {formatDate(invoice.reservation_date)}
                    {invoice.reservation_party_size && ` - ${invoice.reservation_party_size} personas`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bo-publicInvoiceSummary" data-slot="amount-summary">
          <div className="bo-publicInvoiceSummaryRow" data-slot="row-base">
            <span>Base Imponible</span>
            <span>{formatPrice(invoice.amount, currency)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div className="bo-publicInvoiceSummaryRow" data-slot="row-iva">
              <span>IVA ({invoice.iva_rate}%)</span>
              <span>{formatPrice(invoice.iva_amount || 0, currency)}</span>
            </div>
          )}
          <div className="bo-publicInvoiceSummaryRow bo-publicInvoiceSummaryTotal" data-slot="row-total">
            <span>Total</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="bo-publicInvoiceSection" data-slot="payment-history-section">
            <h3 data-ui="section-title-history">Historial de Pagos</h3>
            <table className="bo-table bo-table--sm" data-ui="payments-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} data-slot="payment-row">
                    <td data-slot="payment-date">{formatDateShort(payment.payment_date)}</td>
                    <td data-slot="payment-method" style={{ textTransform: "capitalize" }}>{payment.payment_method}</td>
                    <td data-slot="payment-amount">{formatPrice(payment.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="bo-publicInvoiceFooter" data-slot="footer">
          <p>
            Si tiene alguna pregunta sobre esta factura, por favor contacte con nosotros.
          </p>
          <p className="bo-publicInvoiceFooterContact" data-ui="footer-contact">
            <Mail size={14} /> villacarmen@example.com | <Phone size={14} /> +34 900 000 000
          </p>
        </div>
      </div>
    </div>
  );
}
