/**
 * Invoice Reminder Types
 * Types for invoice reminders and templates
 */

import type { Invoice, ReminderTemplate, SendReminderInput } from "../../../../api/types";

export interface ReminderModalProps {
  invoice: Invoice;
  open: boolean;
  onClose: () => void;
  onReminderSent?: () => void;
}

export interface ReminderHistoryModalProps {
  invoiceId: number;
  invoiceNumber?: string;
  customerName: string;
  open: boolean;
  onClose: () => void;
}

export interface ReminderTemplatesModalProps {
  open: boolean;
  onClose: () => void;
  onTemplatesChanged?: () => void;
}
