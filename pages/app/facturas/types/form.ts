/**
 * Invoice Form Types
 * Types for the invoice form component
 */

import type { Invoice, InvoiceInput, ReservationSearchResult } from "../../../../api/types";
import type { createClient } from "../../../../api/client";

export interface InvoiceFormRef {
  save: (shouldSend?: boolean) => void;
}

export interface InvoiceFormProps {
  invoice: Invoice | null;
  isDuplicate?: boolean;
  isSubmitting?: boolean;
  onSave: (input: InvoiceInput, shouldSend: boolean) => void;
  onCancel: () => void;
  searchReservations: (params: {
    date_from?: string;
    date_to?: string;
    name?: string;
    phone?: string;
    party_size?: number;
    time?: string;
  }) => Promise<ReservationSearchResult[]>;
  api?: ReturnType<typeof createClient>;
  currentUserId?: number;
}

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";
