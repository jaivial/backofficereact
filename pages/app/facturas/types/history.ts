/**
 * Invoice History Types
 * Types for invoice history modals
 */

import type { Invoice, InvoiceHistory, InvoiceHistoryAction } from "../../../../api/types";

export interface InvoiceHistoryModalProps {
  invoiceId: number;
  invoiceNumber?: string;
  customerName?: string;
  open: boolean;
  onClose: () => void;
}

export interface CustomerHistoryModalProps {
  open: boolean;
  customerName: string;
  customerEmail: string;
  onClose: () => void;
  fetchInvoicesByEmail: (email: string) => Promise<Invoice[]>;
}

export const ACTION_CONFIG: Record<InvoiceHistoryAction, { label: string; icon: React.ReactNode; className: string }> = {
  created: { label: "Creada", icon: null, className: "bo-historyAction--created" },
  updated: { label: "Actualizada", icon: null, className: "bo-historyAction--updated" },
  status_changed: { label: "Estado cambiado", icon: null, className: "bo-historyAction--status" },
  deleted: { label: "Eliminada", icon: null, className: "bo-historyAction--deleted" },
  sent: { label: "Enviada", icon: null, className: "bo-historyAction--sent" },
  duplicated: { label: "Duplicada", icon: null, className: "bo-historyAction--duplicated" },
  renumbered: { label: "Renumerada", icon: null, className: "bo-historyAction--updated" },
};
