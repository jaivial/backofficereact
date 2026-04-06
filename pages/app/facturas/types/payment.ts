/**
 * Invoice Payment Types
 * Types for payment registration
 */

import type { Invoice, InvoicePayment, InvoicePaymentInput, PaymentMethod } from "../../../../api/types";

export interface RegisterPaymentModalProps {
  invoice: Invoice;
  payments: InvoicePayment[];
  onClose: () => void;
  onAddPayment: (invoiceId: number, input: InvoicePaymentInput) => Promise<void>;
  onDeletePayment: (paymentId: number) => Promise<void>;
}

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
  { value: "bizum", label: "Bizum" },
  { value: "cheque", label: "Cheque" },
];
