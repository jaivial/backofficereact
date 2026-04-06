/**
 * Invoice Line Items Types
 * Types for invoice line items component
 */

import type { InvoiceLineItem, InvoiceLineItemInput, CurrencyCode } from "../../../../api/types";

export interface LineItemsRef {
  getLineItems: () => InvoiceLineItemInput[];
  isValid: () => boolean;
}

export interface LineItemsProps {
  items: InvoiceLineItem[];
  onChange: (items: InvoiceLineItem[]) => void;
  currency?: CurrencyCode;
  defaultIvaRate?: number;
  disabled?: boolean;
}
