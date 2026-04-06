/**
 * Recurring Billing Types
 * Types for recurring invoice billing
 */

import type { RecurringFrequency, RecurringInvoiceStatus } from "../../../../api/recurring-types";

export interface RecurringBillingData {
  is_recurring: boolean;
  frequency?: RecurringFrequency;
  start_date?: string;
  end_date?: string;
  next_billing_date?: string;
  is_active?: boolean;
  auto_send?: boolean;
  invoice_count?: number;
  last_invoice_date?: string;
}

export interface RecurringBillingSectionProps {
  data: RecurringBillingData;
  onChange: (data: RecurringBillingData) => void;
  disabled?: boolean;
  showStatus?: boolean;
  status?: RecurringInvoiceStatus;
  onPause?: () => void;
  onResume?: () => void;
}
