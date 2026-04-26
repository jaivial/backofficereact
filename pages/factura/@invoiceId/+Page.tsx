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
    <span className={`bo-badge ${config.className}`} data-slot="@invoiceId-span">
      {config.icon}
      <span data-slot="@invoiceId-bel">{config.label}</span>
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
      <div className="bo-publicInvoice" data-slot="@invoiceId-publicInvoice">
        <div className="bo-publicInvoiceError" data-slot="@invoiceId-publicInvoiceError">
          <div className="bo-publicInvoiceErrorIcon" data-slot="@invoiceId-publicInvoiceErrorIcon">
            <AlertCircle size={48} />
          </div>
          <h1 data-slot="@invoiceId-ror">Error</h1>
          <p data-slot="@invoiceId-ror">{error}</p>
          <p className="bo-publicInvoiceErrorHint" data-slot="@invoiceId-publicInvoiceErrorHint">
            Por favor, contacte con nosotros si cree que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="bo-publicInvoice" data-slot="@invoiceId-publicInvoice">
        <div className="bo-publicInvoiceLoading" data-slot="@invoiceId-publicInvoiceLoading">
          <div className="bo-spinner" data-slot="@invoiceId-spinner" />
          <p data-slot="@invoiceId-ura">Cargando factura...</p>
        </div>
      </div>
    );
  }

  const paymentInfo = getPaymentStatusInfo(invoice);
  const total = invoice.total || invoice.amount;
  const currency = invoice.currency || "EUR";

  return (
    <div className="bo-publicInvoice" data-slot="@invoiceId-publicInvoice">
      <div className="bo-publicInvoiceContainer" data-slot="@invoiceId-publicInvoiceContainer">
        {/* Header */}
        <div className="bo-publicInvoiceHeader" data-slot="@invoiceId-publicInvoiceHeader">
          <div className="bo-publicInvoiceBrand" data-slot="@invoiceId-publicInvoiceBrand">
            <h1 data-slot="@invoiceId-men">Villa Carmen</h1>
            <p data-slot="@invoiceId-nte">Restaurante</p>
          </div>
          <div className="bo-publicInvoiceTitle" data-slot="@invoiceId-publicInvoiceTitle">
            <h2 data-slot="@invoiceId-ura">Factura</h2>
            <p className="bo-publicInvoiceNumber" data-slot="@invoiceId-publicInvoiceNumber">{invoice.invoice_number || `#${invoice.id}`}</p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="bo-publicInvoiceStatusBar" data-slot="@invoiceId-publicInvoiceStatusBar">
          <div className="bo-publicInvoiceStatus" data-slot="@invoiceId-publicInvoiceStatus">
            {getStatusBadge(invoice.status)}
          </div>
          {pdfUrl && (
            <a href={pdfUrl} className="bo-btn bo-btn--primary" target="_blank" rel="noopener noreferrer" data-testid="factura-page-download-pdf-link">
              <Download size={16} />
              Descargar PDF
            </a>
          )}
        </div>

        {/* Payment Status */}
        <div className={`bo-paymentStatus ${paymentInfo.className}`} data-slot="@invoiceId-div">
          <div className="bo-paymentStatusInfo" data-slot="@invoiceId-paymentStatusInfo">
            <strong>{paymentInfo.label}</strong>
            <span data-slot="@invoiceId-ion">{paymentInfo.description}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bo-publicInvoiceSection" data-slot="@invoiceId-publicInvoiceSection">
          <h3 data-slot="@invoiceId-nte">Cliente</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2" data-slot="@invoiceId-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
              <User size={16} />
              <div data-slot="@invoiceId-div">
                <label data-slot="@invoiceId-bre">Nombre</label>
                <p data-slot="@invoiceId-p">
                  {invoice.customer_name}
                  {invoice.customer_surname && ` ${invoice.customer_surname}`}
                </p>
              </div>
            </div>
            {invoice.customer_dni_cif && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <FileText size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-cif">DNI/CIF</label>
                  <p data-slot="@invoiceId-cif">{invoice.customer_dni_cif}</p>
                </div>
              </div>
            )}
            {invoice.customer_email && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <Mail size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-ail">Email</label>
                  <p data-slot="@invoiceId-ail">{invoice.customer_email}</p>
                </div>
              </div>
            )}
            {invoice.customer_phone && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <Phone size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-ono">Teléfono</label>
                  <p data-slot="@invoiceId-one">{invoice.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
          {(invoice.customer_address_street || invoice.customer_address_city) && (
            <div className="bo-publicInvoiceField bo-publicInvoiceField--full" data-slot="@invoiceId-publicInvoiceField--full">
              <MapPin size={16} />
              <div data-slot="@invoiceId-div">
                <label data-slot="@invoiceId-cci">Dirección</label>
                <p data-slot="@invoiceId-p">
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
        <div className="bo-publicInvoiceSection" data-slot="@invoiceId-publicInvoiceSection">
          <h3 data-slot="@invoiceId-ura">Detalles de la Factura</h3>
          <div className="bo-publicInvoiceGrid bo-publicInvoiceGrid--2" data-slot="@invoiceId-publicInvoiceGrid--2">
            <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
              <Calendar size={16} />
              <div data-slot="@invoiceId-div">
                <label data-slot="@invoiceId-ura">Fecha de Factura</label>
                <p data-slot="@invoiceId-ate">{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            {invoice.payment_date && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <Calendar size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-ago">Fecha de Pago</label>
                  <p data-slot="@invoiceId-ate">{formatDate(invoice.payment_date)}</p>
                </div>
              </div>
            )}
            {invoice.payment_method && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <CreditCard size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-ago">Método de Pago</label>
                  <p style={{ textTransform: "capitalize" }} data-slot="@invoiceId-hod">{invoice.payment_method}</p>
                </div>
              </div>
            )}
            {invoice.reservation_date && (
              <div className="bo-publicInvoiceField" data-slot="@invoiceId-publicInvoiceField">
                <Calendar size={16} />
                <div data-slot="@invoiceId-div">
                  <label data-slot="@invoiceId-rva">Fecha de Reserva</label>
                  <p data-slot="@invoiceId-p">
                    {formatDate(invoice.reservation_date)}
                    {invoice.reservation_party_size && ` - ${invoice.reservation_party_size} personas`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bo-publicInvoiceSummary" data-slot="@invoiceId-publicInvoiceSummary">
          <div className="bo-publicInvoiceSummaryRow" data-slot="@invoiceId-publicInvoiceSummaryRow">
            <span data-slot="@invoiceId-ble">Base Imponible</span>
            <span data-slot="@invoiceId-ncy">{formatPrice(invoice.amount, currency)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div className="bo-publicInvoiceSummaryRow" data-slot="@invoiceId-publicInvoiceSummaryRow">
              <span data-slot="@invoiceId-ate">IVA ({invoice.iva_rate}%)</span>
              <span data-slot="@invoiceId-ncy">{formatPrice(invoice.iva_amount || 0, currency)}</span>
            </div>
          )}
          <div className="bo-publicInvoiceSummaryRow bo-publicInvoiceSummaryTotal" data-slot="@invoiceId-publicInvoiceSummaryTotal">
            <span data-slot="@invoiceId-tal">Total</span>
            <span data-slot="@invoiceId-ncy">{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="bo-publicInvoiceSection" data-slot="@invoiceId-publicInvoiceSection">
            <h3 data-slot="@invoiceId-gos">Historial de Pagos</h3>
            <table className="bo-table bo-table--sm" data-slot="@invoiceId-table--sm">
              <thead data-slot="@invoiceId-thead">
                <tr data-slot="@invoiceId-tr">
                  <th data-slot="@invoiceId-cha">Fecha</th>
                  <th data-slot="@invoiceId-odo">Método</th>
                  <th data-slot="@invoiceId-rte">Importe</th>
                </tr>
              </thead>
              <tbody data-slot="@invoiceId-tbody">
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} data-slot="@invoiceId-tr">
                    <td data-slot="@invoiceId-ate">{formatDateShort(payment.payment_date)}</td>
                    <td style={{ textTransform: "capitalize" }} data-slot="@invoiceId-hod">{payment.payment_method}</td>
                    <td data-slot="@invoiceId-ncy">{formatPrice(payment.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="bo-publicInvoiceFooter" data-slot="@invoiceId-publicInvoiceFooter">
          <p data-slot="@invoiceId-p">
            Si tiene alguna pregunta sobre esta factura, por favor contacte con nosotros.
          </p>
          <p className="bo-publicInvoiceFooterContact" data-slot="@invoiceId-publicInvoiceFooterContact">
            <Mail size={14} /> villacarmen@example.com | <Phone size={14} /> +34 900 000 000
          </p>
        </div>
      </div>
    </div>
  );
}
