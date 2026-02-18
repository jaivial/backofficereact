import React, { useMemo } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { Download, FileText, Calendar, User, Mail, Phone, MapPin, CreditCard, AlertCircle, CheckCircle, Clock } from "lucide-react";
import type { Data } from "./+data";
import { formatCurrency, type CurrencyCode } from "../../../api/types";

function formatPrice(price: number, currency: CurrencyCode = "EUR"): string {
  return formatCurrency(price, currency);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    borrador: { label: "Borrador", className: "bo-badge--gray", icon: <FileText size={14} /> },
    solicitada: { label: "Solicitada", className: "bo-badge--blue", icon: <Clock size={14} /> },
    pendiente: { label: "Pendiente", className: "bo-badge--yellow", icon: <Clock size={14} /> },
    enviada: { label: "Enviada", className: "bo-badge--orange", icon: <Mail size={14} /> },
    pagada: { label: "Pagada", className: "bo-badge--green", icon: <CheckCircle size={14} /> },
  };

  const config = statusConfig[status] || { label: status, className: "bo-badge--gray", icon: <FileText size={14} /> };

  return (
    <span className={`bo-badge ${config.className}`}>
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}

function getPaymentStatusInfo(invoice: { status: string; paid_amount?: number; amount: number; total?: number }) {
  const total = invoice.total || invoice.amount;
  const paid = invoice.paid_amount || 0;
  const pending = total - paid;

  if (invoice.status === "pagada") {
    return {
      label: "Pagada",
      description: "Esta factura ha sido pagada en su totalidad",
      className: "bo-paymentStatus--paid",
    };
  }

  if (paid > 0) {
    return {
      label: `Pendiente: ${formatPrice(pending)}`,
      description: `Pagado: ${formatPrice(paid)} de ${formatPrice(total)}`,
      className: "bo-paymentStatus--partial",
    };
  }

  return {
    label: `Pendiente: ${formatPrice(total)}`,
    description: "Esta factura awaiting payment",
    className: "bo-paymentStatus--pending",
  };
}

export default function Page() {
  const pageContext = usePageContext();
  const { invoice, error, backendOrigin } = pageContext.data as Data;

  const pdfUrl = useMemo(() => {
    if (!invoice?.id) return null;
    return `${backendOrigin}/api/public/invoices/${invoice.id}/pdf`;
  }, [invoice?.id, backendOrigin]);

  if (error) {
    return (
      <div className="bo-publicInvoice">
        <div className="bo-publicInvoiceError">
          <div className="bo-publicInvoiceErrorIcon">
            <AlertCircle size={48} />
          </div>
          <h1>Error</h1>
          <p>{error}</p>
          <p className="bo-publicInvoiceErrorHint">
            Por favor, contacte con nosotros si cree que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="bo-publicInvoice">
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
        <div className="bo-publicInvoiceHeader">
          <div className="bo-publicInvoiceBrand">
            <h1>Villa Carmen</h1>
            <p>Restaurante</p>
          </div>
          <div className="bo-publicInvoiceTitle">
            <h2>Factura</h2>
            <p className="bo-publicInvoiceNumber">{invoice.invoice_number || `#${invoice.id}`}</p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="bo-publicInvoiceStatusBar">
          <div className="bo-publicInvoiceStatus">
            {getStatusBadge(invoice.status)}
          </div>
          {pdfUrl && (
            <a href={pdfUrl} className="bo-btn bo-btn--primary" target="_blank" rel="noopener noreferrer">
              <Download size={16} />
              Descargar PDF
            </a>
          )}
        </div>

        {/* Payment Status */}
        <div className={`bo-paymentStatus ${paymentInfo.className}`}>
          <div className="bo-paymentStatusInfo">
            <strong>{paymentInfo.label}</strong>
            <span>{paymentInfo.description}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bo-publicInvoiceSection">
          <h3>Cliente</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField">
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
              <div className="bo-publicInvoiceField">
                <FileText size={16} />
                <div>
                  <label>DNI/CIF</label>
                  <p>{invoice.customer_dni_cif}</p>
                </div>
              </div>
            )}
            {invoice.customer_email && (
              <div className="bo-publicInvoiceField">
                <Mail size={16} />
                <div>
                  <label>Email</label>
                  <p>{invoice.customer_email}</p>
                </div>
              </div>
            )}
            {invoice.customer_phone && (
              <div className="bo-publicInvoiceField">
                <Phone size={16} />
                <div>
                  <label>Teléfono</label>
                  <p>{invoice.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
          {(invoice.customer_address_street || invoice.customer_address_city) && (
            <div className="bo-publicInvoiceField bo-publicInvoiceField--full">
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
        <div className="bo-publicInvoiceSection">
          <h3>Detalles de la Factura</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField">
              <Calendar size={16} />
              <div>
                <label>Fecha de Factura</label>
                <p>{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            {invoice.payment_date && (
              <div className="bo-publicInvoiceField">
                <Calendar size={16} />
                <div>
                  <label>Fecha de Pago</label>
                  <p>{formatDate(invoice.payment_date)}</p>
                </div>
              </div>
            )}
            {invoice.payment_method && (
              <div className="bo-publicInvoiceField">
                <CreditCard size={16} />
                <div>
                  <label>Método de Pago</label>
                  <p style={{ textTransform: "capitalize" }}>{invoice.payment_method}</p>
                </div>
              </div>
            )}
            {invoice.reservation_date && (
              <div className="bo-publicInvoiceField">
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
        <div className="bo-publicInvoiceSummary">
          <div className="bo-publicInvoiceSummaryRow">
            <span>Base Imponible</span>
            <span>{formatPrice(invoice.amount, currency)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div className="bo-publicInvoiceSummaryRow">
              <span>IVA ({invoice.iva_rate}%)</span>
              <span>{formatPrice(invoice.iva_amount || 0, currency)}</span>
            </div>
          )}
          <div className="bo-publicInvoiceSummaryRow bo-publicInvoiceSummaryTotal">
            <span>Total</span>
            <span>{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="bo-publicInvoiceSection">
            <h3>Historial de Pagos</h3>
            <table className="bo-table bo-table--sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Importe</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateShort(payment.payment_date)}</td>
                    <td style={{ textTransform: "capitalize" }}>{payment.payment_method}</td>
                    <td>{formatPrice(payment.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="bo-publicInvoiceFooter">
          <p>
            Si tiene alguna pregunta sobre esta factura, por favor contacte con nosotros.
          </p>
          <p className="bo-publicInvoiceFooterContact">
            <Mail size={14} /> villacarmen@example.com | <Phone size={14} /> +34 900 000 000
          </p>
        </div>
      </div>
    </div>
  );
}
