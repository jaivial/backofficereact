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
    borrador: { label: "Borrador", className: "bg-white/[0.06] text-muted-foreground border", icon: <FileText size={14} /> },
    solicitada: { label: "Solicitada", className: "bg-[var(--text-info)]/[0.16] text-[var(--text-info)] border-[var(--text-info)]/[0.30]", icon: <Clock size={14} /> },
    pendiente: { label: "Pendiente", className: "bg-[var(--text-warning)]/[0.16] text-[var(--text-warning)] border-[var(--text-warning)]/[0.30]", icon: <Clock size={14} /> },
    enviada: { label: "Enviada", className: "bg-[#f97316]/[0.16] text-[#f97316] border-[#f97316]/[0.30]", icon: <Mail size={14} /> },
    pagada: { label: "Pagada", className: "bg-[var(--text-success)]/[0.16] text-[var(--text-success)] border-[var(--text-success)]/[0.30]", icon: <CheckCircle size={14} /> },
  };

  const config = statusConfig[status] || { label: status, className: "bg-white/[0.06] text-muted-foreground border", icon: <FileText size={14} /> };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border ${config.className}`}>
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
      className: "bg-[var(--text-success)]/[0.1] border border-[var(--text-success)]/[0.3]",
    };
  }

  if (paid > 0) {
    return {
      label: `Pendiente: ${formatPrice(pending)}`,
      description: `Pagado: ${formatPrice(paid)} de ${formatPrice(total)}`,
      className: "bg-blue-500/[0.1] border border-blue-500/[0.3]",
    };
  }

  return {
    label: `Pendiente: ${formatPrice(total)}`,
    description: "Esta factura awaiting payment",
    className: "bg-amber-500/[0.1] border border-amber-500/[0.3]",
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
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[400px] mx-auto mt-[100px] text-center p-8 bg-white dark:bg-[#1e1e2e] rounded-xl shadow-md">
          <div className="text-red-500 mb-4">
            <AlertCircle size={48} />
          </div>
          <h1 className="text-xl font-semibold text-foreground mb-2">Error</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground">
            Por favor, contacte con nosotros si cree que esto es un error.
          </p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[200px] mx-auto mt-[100px] text-center">
          <div className="animate-spin h-5 w-5 mx-auto mb-4 border-2 border-muted-foreground border-t-accent rounded-full" />
          <p className="text-muted-foreground">Cargando factura...</p>
        </div>
      </div>
    );
  }

  const paymentInfo = getPaymentStatusInfo(invoice);
  const total = invoice.total || invoice.amount;
  const currency = invoice.currency || "EUR";

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[800px] mx-auto bg-white dark:bg-[#1e1e2e] rounded-xl shadow-md p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 pb-6 border-b border">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Villa Carmen</h1>
            <p className="text-sm text-muted-foreground mt-1">Restaurante</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Factura</h2>
            <p className="text-2xl font-bold text-accent mt-1">{invoice.invoice_number || `#${invoice.id}`}</p>
          </div>
        </div>

        {/* Status and Actions */}
        <div className="flex justify-between items-center mb-4">
          <div>
            {getStatusBadge(invoice.status)}
          </div>
          {pdfUrl && (
            <a href={pdfUrl} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-foreground text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto" target="_blank" rel="noopener noreferrer">
              <Download size={16} />
              Descargar PDF
            </a>
          )}
        </div>

        {/* Payment Status */}
        <div className={`p-4 rounded-lg mb-6 flex items-center ${paymentInfo.className === 'bo-paymentStatus--paid' ? 'bg-[var(--text-success)]/[0.1] border border-[var(--text-success)]/[0.3]' : paymentInfo.className === 'bo-paymentStatus--partial' ? 'bg-blue-500/[0.1] border border-blue-500/[0.3]' : 'bg-amber-500/[0.1] border border-amber-500/[0.3]'}`}>
          <div className="flex flex-col gap-1">
            <strong className="text-base">{paymentInfo.label}</strong>
            <span className="text-sm text-muted-foreground">{paymentInfo.description}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b border">Cliente</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <User size={16} />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Nombre</label>
                <p className="text-foreground">
                  {invoice.customer_name}
                  {invoice.customer_surname && ` ${invoice.customer_surname}`}
                </p>
              </div>
            </div>
            {invoice.customer_dni_cif && (
              <div className="flex flex-col gap-1">
                <FileText size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">DNI/CIF</label>
                  <p className="text-foreground">{invoice.customer_dni_cif}</p>
                </div>
              </div>
            )}
            {invoice.customer_email && (
              <div className="flex flex-col gap-1">
                <Mail size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Email</label>
                  <p className="text-foreground">{invoice.customer_email}</p>
                </div>
              </div>
            )}
            {invoice.customer_phone && (
              <div className="flex flex-col gap-1">
                <Phone size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Teléfono</label>
                  <p className="text-foreground">{invoice.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
          {(invoice.customer_address_street || invoice.customer_address_city) && (
            <div className="flex gap-3 mt-3">
              <MapPin size={16} className="text-muted-foreground flex-shrink-0 mt-1" />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Dirección</label>
                <p className="text-foreground">
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
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b border">Detalles de la Factura</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Calendar size={16} />
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Fecha de Factura</label>
                <p className="text-foreground">{formatDate(invoice.invoice_date)}</p>
              </div>
            </div>
            {invoice.payment_date && (
              <div className="flex flex-col gap-1">
                <Calendar size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Fecha de Pago</label>
                  <p className="text-foreground">{formatDate(invoice.payment_date)}</p>
                </div>
              </div>
            )}
            {invoice.payment_method && (
              <div className="flex flex-col gap-1">
                <CreditCard size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Método de Pago</label>
                  <p className="text-foreground capitalize">{invoice.payment_method}</p>
                </div>
              </div>
            )}
            {invoice.reservation_date && (
              <div className="flex flex-col gap-1">
                <Calendar size={16} />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Fecha de Reserva</label>
                  <p className="text-foreground">
                    {formatDate(invoice.reservation_date)}
                    {invoice.reservation_party_size && ` - ${invoice.reservation_party_size} personas`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bg-white dark:bg-white/[0.05] rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center py-2 border-b border">
            <span className="text-muted-foreground text-sm">Base Imponible</span>
            <span className="font-semibold text-foreground">{formatPrice(invoice.amount, currency)}</span>
          </div>
          {invoice.iva_rate && invoice.iva_rate > 0 && (
            <div className="flex justify-between items-center py-2 border-b border">
              <span className="text-muted-foreground text-sm">IVA ({invoice.iva_rate}%)</span>
              <span className="font-semibold text-foreground">{formatPrice(invoice.iva_amount || 0, currency)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3">
            <span className="text-base font-semibold text-foreground">Total</span>
            <span className="text-xl font-bold text-accent">{formatPrice(total, currency)}</span>
          </div>
        </div>

        {/* Payment History */}
        {invoice.payments && invoice.payments.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4 pb-2 border-b border">Historial de Pagos</h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="text-left text-muted-foreground font-medium py-2">Fecha</th>
                  <th className="text-left text-muted-foreground font-medium py-2">Método</th>
                  <th className="text-right text-muted-foreground font-medium py-2">Importe</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((payment) => (
                  <tr key={payment.id} className="border-t border">
                    <td className="py-2 text-foreground">{formatDateShort(payment.payment_date)}</td>
                    <td className="py-2 text-foreground capitalize">{payment.payment_method}</td>
                    <td className="py-2 text-right text-foreground">{formatPrice(payment.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 border-t border mt-8">
          <p className="text-muted-foreground text-sm mb-2">
            Si tiene alguna pregunta sobre esta factura, por favor contacte con nosotros.
          </p>
          <p className="flex justify-center gap-4 text-muted-foreground text-sm">
            <span><Mail size={14} className="inline mr-1" /> villacarmen@example.com</span>
            <span><Phone size={14} className="inline mr-1" /> +34 900 000 000</span>
          </p>
        </div>
      </div>
    </div>
  );
}
