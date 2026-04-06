/**
 * Invoice Send Types
 * Types for sending invoices via email, WhatsApp, or batch
 */

import type { Invoice } from "../../../../api/types";

export interface SendEmailModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

export interface SendWhatsAppModalProps {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onSent: (invoice: Invoice) => void;
}

export interface BatchSendModalProps {
  open: boolean;
  invoices: Invoice[];
  onClose: () => void;
  onSent: (invoices: Invoice[]) => void;
}

export interface SendResult {
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  success: boolean;
  error?: string;
}

export type SendStatus = "idle" | "sending" | "completed" | "retrying";
