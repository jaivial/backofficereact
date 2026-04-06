/**
 * Facturas Page Constants
 * Static configuration values for the facturas (invoices) page
 */

import type { InvoiceStatus } from "../../../../api/types";

export const INVOICE_STATUS_OPTIONS: { value: InvoiceStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "borrador", label: "Borrador" },
  { value: "solicitada", label: "Solicitada" },
  { value: "pendiente", label: "Pendiente" },
  { value: "enviada", label: "Enviada" },
];

export const INVOICE_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "date_desc", label: "Fecha mas reciente" },
  { value: "date_asc", label: "Fecha mas antigua" },
  { value: "amount_desc", label: "Importe mayor" },
  { value: "amount_asc", label: "Importe menor" },
];

export const PAGE_TABS = {
  RESUMEN: "resumen",
  AÑADIR: "añadir",
} as const;
