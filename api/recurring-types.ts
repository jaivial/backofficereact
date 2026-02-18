// Recurring Billing Types - Extended from api/types.ts
import type { CurrencyCode, PaymentMethod, InvoiceCategory } from "./types";

export type RecurringFrequency = "weekly" | "monthly" | "quarterly";

export const RECURRING_FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string; description: string }[] = [
  { value: "weekly", label: "Semanal", description: "Cada semana" },
  { value: "monthly", label: "Mensual", description: "Cada mes" },
  { value: "quarterly", label: "Trimestral", description: "Cada 3 meses" },
];

export type RecurringInvoiceStatus = "pending" | "sending" | "sent" | "failed";

export type RecurringInvoice = {
  id: number;
  restaurant_id: number;
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  amount: number;
  currency: CurrencyCode;
  iva_rate?: number;
  iva_amount?: number;
  total?: number;
  payment_method?: PaymentMethod;
  account_image_url?: string;
  internal_notes?: string;
  category?: InvoiceCategory;
  tags?: string[];
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  next_billing_date: string;
  is_active: boolean;
  auto_send: boolean;
  auto_send_status?: RecurringInvoiceStatus;
  last_invoice_id?: number;
  last_invoice_date?: string;
  invoice_count: number;
  created_at: string;
  updated_at: string;
};

export type RecurringInvoiceInput = {
  customer_name: string;
  customer_surname?: string;
  customer_email: string;
  customer_dni_cif?: string;
  customer_phone?: string;
  customer_address_street?: string;
  customer_address_number?: string;
  customer_address_postal_code?: string;
  customer_address_city?: string;
  customer_address_province?: string;
  customer_address_country?: string;
  amount: number;
  currency: CurrencyCode;
  iva_rate?: number;
  iva_amount?: number;
  total?: number;
  payment_method?: PaymentMethod;
  account_image_url?: string;
  internal_notes?: string;
  category?: InvoiceCategory;
  tags?: string[];
  frequency: RecurringFrequency;
  start_date: string;
  end_date?: string;
  next_billing_date?: string;
  is_active?: boolean;
  auto_send?: boolean;
};

export type RecurringInvoiceLog = {
  id: number;
  recurring_invoice_id: number;
  invoice_id: number;
  generated_at: string;
  error_message?: string;
  status: "success" | "failed";
};

export type RecurringInvoiceListParams = {
  is_active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

export type RecurringInvoiceListResponse = {
  success: boolean;
  recurringInvoices: RecurringInvoice[];
  total: number;
  page: number;
  limit: number;
};

export type RecurringInvoiceResponse = {
  success: boolean;
  recurringInvoice?: RecurringInvoice;
  message?: string;
  id?: number;
};

export type RecurringInvoiceLogListResponse = {
  success: boolean;
  logs: RecurringInvoiceLog[];
  total: number;
};
