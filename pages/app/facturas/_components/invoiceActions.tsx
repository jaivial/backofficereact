import { CreditCard, Eye, Mail, PencilLine, Trash2 } from "lucide-react";
import type { MenuItem } from "../../../../ui/inputs/DropdownMenu";
import type { Invoice } from "../../../../api/types";

/** Handlers every per-invoice action surface (table row + grid card) needs. */
export type InvoiceActionHandlers = {
  onPreview: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onRegisterPayment: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

/**
 * Single source of truth for the per-invoice 3-dots menu, so the table row and
 * the grid card expose exactly the same actions and order.
 * Coordination id: facturas_actions_v1
 */
export function buildInvoiceActionItems(invoice: Invoice, h: InvoiceActionHandlers): MenuItem[] {
  return [
    { id: "view", label: "Ver detalles", icon: <Eye size={16} />, onSelect: () => h.onPreview(invoice) },
    { id: "edit", label: "Editar", icon: <PencilLine size={16} />, onSelect: () => h.onEdit(invoice) },
    { id: "register-payment", label: "Registrar pago", icon: <CreditCard size={16} />, onSelect: () => h.onRegisterPayment(invoice) },
    ...(invoice.customer_email
      ? [{
          id: "send-email",
          label: invoice.status === "enviada" ? "Reenviar email" : "Enviar email",
          icon: <Mail size={16} />,
          onSelect: () => h.onSendEmail(invoice),
        }]
      : []),
    { id: "delete", label: "Borrar", icon: <Trash2 size={16} />, tone: "danger" as const, onSelect: () => h.onDelete(invoice) },
  ];
}
