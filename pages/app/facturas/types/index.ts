/**
 * Facturas Page Types
 * TypeScript interfaces and types specific to the facturas (invoices) page
 *
 * Re-exports all shared types from submodules
 */

// Import types for local use (also re-exported below)
import type {
  Invoice,
  InvoiceStatus,
  InvoiceCategory,
  PaymentMethod,
  InvoiceInput,
  InvoiceListParams,
  InvoicePayment,
  InvoicePaymentInput,
  InvoiceAttachment,
  InvoiceLineItem,
  InvoiceLineItemInput,
  InvoiceTemplate,
  InvoiceTemplateInput,
  InvoiceHistory,
  InvoiceHistoryAction,
  InvoiceReminder,
  ReminderTemplate,
  ReminderTemplateInput,
  SendReminderInput,
  InvoiceMergeInput,
  InvoiceSplitInput,
  InvoiceSplitItem,
  InvoiceSplitMethod,
  InvoiceDepositType,
  ReservationSearchResult,
  PdfTemplateType,
} from "../../../../api/types";

// Re-export from api/types
export type {
  Invoice,
  InvoiceStatus,
  InvoiceCategory,
  PaymentMethod,
  InvoiceInput,
  InvoiceListParams,
  InvoicePayment,
  InvoicePaymentInput,
  InvoiceAttachment,
  InvoiceLineItem,
  InvoiceLineItemInput,
  InvoiceTemplate,
  InvoiceTemplateInput,
  InvoiceHistory,
  InvoiceHistoryAction,
  InvoiceReminder,
  ReminderTemplate,
  ReminderTemplateInput,
  SendReminderInput,
  InvoiceMergeInput,
  InvoiceSplitInput,
  InvoiceSplitItem,
  InvoiceSplitMethod,
  InvoiceDepositType,
  ReservationSearchResult,
  PdfTemplateType,
} from "../../../../api/types";

// Re-export from api/recurring-types
export type {
  RecurringFrequency,
  RecurringInvoiceStatus,
} from "../../../../api/recurring-types";

// Re-export from local type modules
export * from "./invoice";
export * from "./filters";
export * from "./table";
export * from "./send";
export * from "./reminder";
export * from "./recurring";
export * from "./batchOps";
export * from "./template";
export * from "./form";
export * from "./lineItems";
export * from "./payment";
export * from "./attachments";
export * from "./history";

// Page-specific types
export type PageData = {
  invoices: Invoice[];
  total: number;
  page: number;
  limit: number;
  error: string | null;
};

export type SortBy = "amount_asc" | "amount_desc" | "date_asc" | "date_desc";
export type DateType = "invoice_date" | "reservation_date";
export type StatusFilter = InvoiceStatus | "";
