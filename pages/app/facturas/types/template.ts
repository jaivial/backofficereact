/**
 * Invoice Template Types
 * Types for invoice templates
 */

import type { InvoiceTemplate, InvoiceTemplateInput } from "../../../../api/types";

export interface SelectTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: InvoiceTemplate) => void;
}

export interface TemplateFormProps {
  template: InvoiceTemplate | null;
  onSave: () => void;
  onCancel: () => void;
}
