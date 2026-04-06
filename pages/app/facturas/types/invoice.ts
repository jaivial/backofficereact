/**
 * Invoice Core Types
 * Types shared across invoice components
 */

import type { Invoice, InvoiceStatus, InvoiceCategory, PaymentMethod } from "../../../../api/types";

// Status config shared across components
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bo-badge--muted" },
  solicitada: { label: "Solicitada", className: "bo-badge--warning" },
  pendiente: { label: "Pendiente", className: "bo-badge--info" },
  enviada: { label: "Enviada", className: "bo-badge--success" },
  pagada: { label: "Pagada", className: "bo-badge--success" },
};

// Payment method labels
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  bizum: "Bizum",
  cheque: "Cheque",
};

// Category config
export const CATEGORY_CONFIG: Record<InvoiceCategory, { label: string; className: string }> = {
  reserva: { label: "Reserva", className: "bo-badge--info" },
  productos: { label: "Productos", className: "bo-badge--success" },
  servicios: { label: "Servicios", className: "bo-badge--warning" },
  otros: { label: "Otros", className: "bo-badge--muted" },
  nota_credito: { label: "Nota de credito", className: "bo-badge--warning" },
};

// All invoice statuses for bulk operations
export const ALL_INVOICE_STATUSES: InvoiceStatus[] = ["borrador", "solicitada", "pendiente", "enviada", "pagada"];
