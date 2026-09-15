/**
 * Invoice Table Types
 * Types for the invoice table component
 */

import type { Invoice, InvoiceStatus, InvoiceAttachment, InvoiceDepositType } from "../../../../api/types";
import type { InvoiceColumnId } from "../_components/invoiceColumns";

export type { InvoiceColumnId };

/** Sortable invoice columns; matches the InvoiceColumnId set (facturas_columns_preference_v1). */
export type SortField =
  | "invoice_number"
  | "customer_name"
  | "customer_email"
  | "amount"
  | "currency"
  | "payment_progress"
  | "invoice_date"
  | "due_date"
  | "payment_date"
  | "payment_method"
  | "status"
  | "is_reservation"
  | "deposit"
  | "category";
export type SortDirection = "asc" | "desc";

export interface InvoiceTableProps {
  invoices: Invoice[];
  /** Visible data columns (user preference facturasVisibleColumns). facturas_columns_preference_v1 */
  visibleColumns: InvoiceColumnId[];
  loading: boolean;
  page: number;
  totalPages: number;
  total: number;
  sortField: SortField | null;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  hasFilters: boolean;
  onCreateNew: () => void;
  onEdit: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
  onSplit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
  onSendWhatsApp: (invoice: Invoice) => void;
  onPageChange: (page: number) => void;
  onStatusChange: (invoice: Invoice, newStatus: InvoiceStatus) => void;
  onBulkStatusChange: (invoices: Invoice[], newStatus: InvoiceStatus) => void;
  onBulkDelete: (invoices: Invoice[]) => void;
  onBulkPrint: (invoices: Invoice[]) => void;
  onBulkMerge: (invoices: Invoice[]) => void;
  onBulkSendEmail: (invoices: Invoice[]) => void;
  onPrintAllVisible: () => void;
  onPreview: (invoice: Invoice) => void;
  onViewCustomerHistory: (customerName: string, customerEmail: string) => void;
  onShowHistory: (invoice: Invoice) => void;
  onViewNotes: (invoice: Invoice) => void;
  onRegisterPayment: (invoice: Invoice) => void;
  onSendReminder: (invoice: Invoice) => void;
  onShowReminderHistory: (invoice: Invoice) => void;
  onManageTemplates: () => void;
  onCreateCreditNote?: (invoice: Invoice) => void;
  onRemoveAttachment?: (invoiceId: number, attachmentId: number) => Promise<void>;
  onDownloadAllAttachments?: (attachments: InvoiceAttachment[]) => Promise<void>;
  onMergeInvoices?: (input: { invoice_ids: number[]; delete_originals: boolean }) => Promise<void>;
}

export const DEPOSIT_CONFIG: Record<InvoiceDepositType, { label: string; className: string }> = {
  advance: { label: "Anticipo", className: "bo-badge--info" },
  deposit: { label: "Seña", className: "bo-badge--warning" },
};
