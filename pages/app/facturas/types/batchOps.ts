/**
 * Batch Operations Types
 * Types for split, merge, and other batch operations on invoices
 */

import type { Invoice, InvoiceSplitInput, InvoiceMergeInput, InvoiceSplitMethod, InvoiceSplitItem, CurrencyCode } from "../../../../api/types";

export interface SplitInvoiceModalProps {
  invoice: Invoice;
  isOpen: boolean;
  onClose: () => void;
  onSplit: (input: InvoiceSplitInput) => Promise<{ success: boolean; message?: string }>;
}

export const INITIAL_SPLIT_ITEM: Omit<InvoiceSplitItem, "customer_name" | "customer_email"> = {
  customer_dni_cif: "",
  customer_surname: "",
  customer_phone: "",
  customer_address_street: "",
  customer_address_number: "",
  customer_address_postal_code: "",
  customer_address_city: "",
  customer_address_province: "",
  customer_address_country: "",
};

export interface MergeInvoicesModalProps {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
  onMerge: (input: InvoiceMergeInput) => Promise<void>;
}
