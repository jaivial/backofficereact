import React from "react";
import { FileText, Clock, Mail, CheckCircle } from "lucide-react";
import { formatCurrency, type CurrencyCode } from "../../../../api/types";

export function formatPrice(price: number, currency: CurrencyCode = "EUR"): string {
  return formatCurrency(price, currency);
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function getStatusBadge(status: string) {
  const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    borrador: { label: "Borrador", className: "bo-badge--gray", icon: <FileText size={14} /> },
    solicitada: { label: "Solicitada", className: "bo-badge--blue", icon: <Clock size={14} /> },
    pendiente: { label: "Pendiente", className: "bo-badge--yellow", icon: <Clock size={14} /> },
    enviada: { label: "Enviada", className: "bo-badge--orange", icon: <Mail size={14} /> },
    pagada: { label: "Pagada", className: "bo-badge--green", icon: <CheckCircle size={14} /> },
  };

  const config = statusConfig[status] || { label: status, className: "bo-badge--gray", icon: <FileText size={14} /> };

  return (
    <span className={`bo-badge ${config.className}`} data-slot="factura.helpers-span">
      {config.icon}
      <span data-slot="factura.helpers-bel">{config.label}</span>
    </span>
  );
}

export function getPaymentStatusInfo(invoice: { status: string; paid_amount?: number; amount: number; total?: number }) {
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
