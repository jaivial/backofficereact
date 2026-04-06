/**
 * Invoice Attachments Types
 * Types for invoice attachments modal
 */

import type { InvoiceAttachment } from "../../../../api/types";

export interface AttachmentsModalProps {
  open: boolean;
  onClose: () => void;
  attachments: InvoiceAttachment[];
  invoiceNumber?: string;
  onRemoveAttachment?: (attachmentId: number) => void;
  onDownloadAll?: (attachments: InvoiceAttachment[]) => void;
  isRemoving?: boolean;
}
