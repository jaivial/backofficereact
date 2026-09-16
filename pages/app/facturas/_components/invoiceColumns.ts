import {
  Activity,
  Banknote,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CircleDollarSign,
  Coins,
  CreditCard,
  FileText,
  Mail,
  PiggyBank,
  Tag,
  Tags,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Invoice } from "../../../../api/types";
import type { SortDirection, SortField } from "../types/table";
import { createColumnVisibility } from "../../../../ui/lib/columnVisibility";

/**
 * Single source of truth for the invoices table data columns, shared by the
 * table renderer, the card grid and the column-picker modal so the three can
 * never drift. Every data column is sortable client-side (page-only order).
 * Coordination id: facturas_columns_preference_v1
 */
export type InvoiceColumnId = SortField;

export type InvoiceColumnDef = {
  id: InvoiceColumnId;
  label: string;
  icon: LucideIcon;
};

export const INVOICE_COLUMNS: InvoiceColumnDef[] = [
  { id: "invoice_number", label: "N. Factura", icon: FileText },
  { id: "customer_name", label: "Cliente", icon: User },
  { id: "customer_email", label: "Email", icon: Mail },
  { id: "amount", label: "Importe", icon: Banknote },
  { id: "currency", label: "Moneda", icon: Coins },
  { id: "payment_progress", label: "Pagado", icon: CircleDollarSign },
  { id: "invoice_date", label: "Fecha", icon: Calendar },
  { id: "due_date", label: "Vencimiento", icon: CalendarClock },
  { id: "payment_date", label: "F. Pago", icon: CalendarCheck },
  { id: "payment_method", label: "Metodo", icon: CreditCard },
  { id: "status", label: "Estado", icon: Activity },
  { id: "is_reservation", label: "Tipo", icon: Tag },
  { id: "deposit", label: "Deposito", icon: PiggyBank },
  { id: "category", label: "Categoria", icon: Tags },
];

export const INVOICE_COLUMN_IDS: InvoiceColumnId[] = INVOICE_COLUMNS.map((c) => c.id);

export const invoiceColumnVisibility = createColumnVisibility(INVOICE_COLUMN_IDS);

/** Sort value for a column; numbers compare numerically, the rest as es strings. */
export function invoiceSortValue(invoice: Invoice, field: InvoiceColumnId): string | number {
  switch (field) {
    case "amount":
      return invoice.amount ?? 0;
    case "payment_progress": {
      const total = invoice.total ?? invoice.amount ?? 0;
      const paid = invoice.paid_amount ?? 0;
      return total > 0 ? paid / total : 0;
    }
    case "deposit":
      return invoice.deposit_amount ?? 0;
    case "is_reservation":
      return invoice.is_reservation ? 1 : 0;
    case "customer_name":
      return `${invoice.customer_name} ${invoice.customer_surname ?? ""}`.trim().toLowerCase();
    case "customer_email":
      return invoice.customer_email ?? "";
    case "invoice_number":
      return invoice.invoice_number ?? "";
    case "currency":
      return invoice.currency ?? "";
    case "payment_method":
      return invoice.payment_method ?? "";
    case "status":
      return invoice.status ?? "";
    case "category":
      return invoice.category ?? "";
    case "invoice_date":
      return invoice.invoice_date ?? "";
    case "due_date":
      return invoice.due_date ?? "";
    case "payment_date":
      return invoice.payment_date ?? "";
  }
}

/** Client-side sort of the current page; never mutates the source array. */
export function sortInvoicesByColumn(
  invoices: Invoice[],
  field: InvoiceColumnId,
  direction: SortDirection,
): Invoice[] {
  const mult = direction === "asc" ? 1 : -1;
  return [...invoices].sort((a, b) => {
    const va = invoiceSortValue(a, field);
    const vb = invoiceSortValue(b, field);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
    return String(va).localeCompare(String(vb), "es") * mult;
  });
}
