/**
 * Invoice Table Types
 * Types for the invoice table component
 */

import type { Invoice, InvoiceStatus, InvoiceAttachment, InvoiceDepositType } from "../../../../api/types";

export type SortField = "amount" | "invoice_date";
export type SortDirection = "asc" | "desc";

export interface InvoiceTableProps {
  invoices: Invoice[];
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
