/**
 * Invoice Filter Types
 * Types for invoice filtering and filtering UI
 */

import type { InvoiceStatus, InvoiceCategory } from "../../../../api/types";

export type DatePreset = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "custom" | "";

export interface InvoiceFilterPreset {
  id: string;
  name: string;
  searchText: string;
  statusFilter: InvoiceStatus | "";
  categoryFilter: InvoiceCategory | "";
  tagFilter: string;
  dateType: "invoice_date" | "reservation_date";
  dateFrom: string;
  dateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  isOverdue: boolean | null;
  isReservation: boolean | null;
  isCreditNote: boolean | null;
  sortBy: string;
}

export type SearchByOption = "name" | "email" | "invoice_number";

export type DateType = "invoice_date" | "reservation_date";

export type SortBy = "amount_asc" | "amount_desc" | "date_asc" | "date_desc";

export type StatusFilter = InvoiceStatus | "";
