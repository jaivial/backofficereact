import { FileText } from "lucide-react";
import type { Invoice } from "../../../../api/types";
import { INVOICE_STATUS_CONFIG } from "../types/invoice";
import { formatDate, formatPrice } from "../utils";
import { INVOICE_COLUMNS, type InvoiceColumnId } from "./invoiceColumns";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { buildInvoiceActionItems, type InvoiceActionHandlers } from "./invoiceActions";

/** Featured slots get dedicated card blocks; the rest stack as detail rows. */
const FEATURED_COLUMNS: ReadonlySet<InvoiceColumnId> = new Set<InvoiceColumnId>([
  "invoice_number",
  "status",
  "customer_name",
  "amount",
  "payment_progress",
]);

/** Plain-text value for the detail rows; "-" mirrors the table cells. */
function invoiceColumnValue(invoice: Invoice, id: InvoiceColumnId): string {
  switch (id) {
    case "customer_email":
      return invoice.customer_email || "-";
    case "currency":
      return invoice.currency || "EUR";
    case "invoice_date":
      return formatDate(invoice.invoice_date);
    case "due_date":
      return invoice.due_date ? formatDate(invoice.due_date) : "-";
    case "payment_date":
      return invoice.payment_date ? formatDate(invoice.payment_date) : "-";
    case "payment_method":
      return invoice.payment_method || "-";
    case "is_reservation":
      return invoice.is_reservation ? "Reserva" : "Sin reserva";
    case "deposit":
      return invoice.deposit_amount ? formatPrice(invoice.deposit_amount, invoice.currency) : "-";
    case "category":
      return invoice.category || "-";
    default:
      return "";
  }
}

/**
 * Card grid alternative to the invoices table ("grid" display mode).
 * Card hierarchy (better-ui): header (number + status), primary block
 * (client + amount), payment progress, then a divided details list of
 * every other visible column. Column visibility prefs drive all slots.
 * Coordination id: facturas_cards_v1 / facturas_cards_columns_v1
 */
export function InvoiceCardGrid({
  invoices,
  visibleColumns,
  onOpenDetails,
  onEdit,
  onRegisterPayment,
  onSendEmail,
  onDelete,
}: {
  invoices: Invoice[];
  visibleColumns: InvoiceColumnId[];
  onOpenDetails: (invoice: Invoice) => void;
  onEdit: (invoice: Invoice) => void;
  onRegisterPayment: (invoice: Invoice) => void;
  onSendEmail: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}) {
  const visibleSet = new Set(visibleColumns);
  // The card itself opens details, so "Vista previa" and the 3-dots menu
  // reuse the same handler; everything else comes from the page.
  const actions: InvoiceActionHandlers = { onPreview: onOpenDetails, onEdit, onRegisterPayment, onSendEmail, onDelete };
  return (
    <div className="bo-invoiceCards" data-testid="facturas-invoiceCards" data-slot="facturas-invoiceCards" data-coordination-id="facturas_cards_v1">
      {invoices.map((invoice) => {
        const status = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, className: "" };
        const total = invoice.total ?? invoice.amount;
        const paid = invoice.paid_amount ?? 0;
        const percentPaid = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
        const showNumber = visibleSet.has("invoice_number");
        const showStatus = visibleSet.has("status");
        const showClient = visibleSet.has("customer_name");
        const showAmount = visibleSet.has("amount");
        const showProgress = visibleSet.has("payment_progress");
        const detailColumns = INVOICE_COLUMNS.filter((col) => visibleSet.has(col.id) && !FEATURED_COLUMNS.has(col.id));
        return (
          <article
            key={invoice.id}
            className="bo-invoiceCard"
            data-testid={`facturas-invoice-card-${invoice.id}`}
            data-slot="facturas-invoice-card"
            data-invoice-id={invoice.id}
            onClick={() => onOpenDetails(invoice)}
          >
            {showNumber || showStatus ? (
              <header className="bo-invoiceCardHead" data-testid={`facturas-invoice-card-head-${invoice.id}`} data-slot="facturas-invoice-card-head">
                {showNumber ? (
                  <span className="bo-invoiceCardNumber" data-testid={`facturas-invoice-card-number-${invoice.id}`} data-slot="facturas-invoice-card-number">
                    <FileText size={13} aria-hidden="true" />
                    {invoice.invoice_number || `#${invoice.id}`}
                  </span>
                ) : null}
                {showStatus ? (
                  <span data-testid={`facturas-invoice-card-status-${invoice.id}`} className={`bo-badge ${status.className}`} data-slot="facturas-invoice-card-status">{status.label}</span>
                ) : null}
              </header>
            ) : null}

            {showClient || showAmount ? (
              <div className="bo-invoiceCardPrimary" data-testid={`facturas-invoice-card-primary-${invoice.id}`} data-slot="facturas-invoice-card-primary">
                {showClient ? (
                  <div className="bo-invoiceCardClient" data-testid={`facturas-invoice-card-client-${invoice.id}`} data-slot="facturas-invoice-card-client">
                    <span className="bo-invoiceCardClientName" data-slot="facturas-invoice-card-client-name">{invoice.customer_name}</span>
                    {invoice.customer_surname ? (
                      <span className="bo-tableCustomerSurname" data-slot="facturas-invoice-card-client-surname">{invoice.customer_surname}</span>
                    ) : null}
                  </div>
                ) : null}
                {showAmount ? (
                  <div className="bo-invoiceCardAmount" data-testid={`facturas-invoice-card-amount-${invoice.id}`} data-slot="facturas-invoice-card-amount">
                    {formatPrice(invoice.amount, invoice.currency)}
                  </div>
                ) : null}
              </div>
            ) : null}

            {showProgress ? (
              <div className="bo-invoiceCardPaid" data-testid={`facturas-invoice-card-paid-${invoice.id}`} data-slot="facturas-invoice-card-paid">
                <div className="bo-invoiceCardPaidBar" data-slot="facturas-invoice-card-paid-bar">
                  <span className={`bo-invoiceCardPaidFill${percentPaid >= 100 ? " is-complete" : ""}`} style={{ width: `${percentPaid}%` }} data-slot="facturas-invoice-card-paid-fill" />
                </div>
                <span className="bo-invoiceCardPaidText" data-slot="facturas-invoice-card-paid-text">
                  {formatPrice(paid, invoice.currency)} / {formatPrice(total, invoice.currency)}
                </span>
              </div>
            ) : null}

            {detailColumns.length > 0 ? (
              <div className="bo-invoiceCardDetails" data-testid={`facturas-invoice-card-details-${invoice.id}`} data-slot="facturas-invoice-card-details">
                {detailColumns.map((col) => (
                  <div className="bo-invoiceCardRow" key={col.id} data-testid={`facturas-invoice-card-col-${col.id}-${invoice.id}`} data-slot={`facturas-invoice-card-col-${col.id}`}>
                    <span className="bo-invoiceCardRowLabel" data-slot={`facturas-invoice-card-col-label-${col.id}`}>{col.label}</span>
                    <span className="bo-invoiceCardRowValue" data-slot={`facturas-invoice-card-col-value-${col.id}`}>{invoiceColumnValue(invoice, col.id)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <footer
              className="bo-invoiceCardFoot"
              data-testid={`facturas-invoice-card-foot-${invoice.id}`}
              data-slot="facturas-invoice-card-foot"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bo-invoiceCardFootActions" data-slot="facturas-invoice-card-foot-actions">
                <button
                  type="button"
                  className="bo-btn bo-btn--ghost bo-btn--sm"
                  onClick={() => onOpenDetails(invoice)}
                  data-testid={`facturas-invoice-card-preview-${invoice.id}`}
                >
                  Vista previa
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn--ghost bo-btn--sm"
                  onClick={() => onSendEmail(invoice)}
                  disabled={!invoice.customer_email}
                  title={invoice.customer_email ? "Enviar por email" : "Sin email de cliente"}
                  data-testid={`facturas-invoice-card-send-${invoice.id}`}
                >
                  Enviar
                </button>
              </div>
              <DropdownMenu
                label={`Acciones de factura ${invoice.invoice_number || invoice.id}`}
                menuMinWidthPx={200}
                menuClassName="bo-panel bo-invoiceFilters bo-menu--panel"
                triggerDataTestId={`facturas-invoice-card-menu-${invoice.id}`}
                items={buildInvoiceActionItems(invoice, actions)}
              />
            </footer>
          </article>
        );
      })}
    </div>
  );
}
