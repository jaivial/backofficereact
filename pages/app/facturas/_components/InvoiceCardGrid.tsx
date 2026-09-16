import { FileText } from "lucide-react";
import type { Invoice } from "../../../../api/types";
import { INVOICE_STATUS_CONFIG } from "../types/invoice";
import { formatDate, formatPrice } from "../utils";
import { INVOICE_COLUMNS, type InvoiceColumnId } from "./invoiceColumns";

/** Plain-text value for the generic card rows; "-" mirrors the table cells. */
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
 * Every visible table column owns a slot on the card, so column
 * visibility prefs drive the cards exactly like the table.
 * Coordination id: facturas_cards_v1 / facturas_cards_columns_v1
 */
export function InvoiceCardGrid({
  invoices,
  visibleColumns,
  onOpenDetails,
}: {
  invoices: Invoice[];
  visibleColumns: InvoiceColumnId[];
  onOpenDetails: (invoice: Invoice) => void;
}) {
  const visibleSet = new Set(visibleColumns);
  return (
    <div className="bo-invoiceCards" data-testid="facturas-invoiceCards" data-slot="facturas-invoiceCards" data-coordination-id="facturas_cards_v1">
      {invoices.map((invoice) => {
        const status = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, className: "" };
        const total = invoice.total ?? invoice.amount;
        const paid = invoice.paid_amount ?? 0;
        const percentPaid = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
        const showNumber = visibleSet.has("invoice_number");
        const showStatus = visibleSet.has("status");
        return (
          <article
            key={invoice.id}
            className="bo-invoiceCard"
            data-testid={`facturas-invoice-card-${invoice.id}`}
            data-slot="facturas-invoice-card"
            data-invoice-id={invoice.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenDetails(invoice)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenDetails(invoice); } }}
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
            {INVOICE_COLUMNS.map((col) => {
              if (!visibleSet.has(col.id)) return null;
              if (col.id === "invoice_number" || col.id === "status") return null; // header slots
              if (col.id === "customer_name") {
                return (
                  <div className="bo-invoiceCardClient" key={col.id} data-testid={`facturas-invoice-card-client-${invoice.id}`} data-slot="facturas-invoice-card-client">
                    <span className="bo-invoiceCardClientName" data-slot="facturas-invoice-card-client-name">{invoice.customer_name}</span>
                    {invoice.customer_surname ? (
                      <span className="bo-tableCustomerSurname" data-slot="facturas-invoice-card-client-surname">{invoice.customer_surname}</span>
                    ) : null}
                  </div>
                );
              }
              if (col.id === "amount") {
                return (
                  <div className="bo-invoiceCardAmount" key={col.id} data-testid={`facturas-invoice-card-amount-${invoice.id}`} data-slot="facturas-invoice-card-amount">
                    {formatPrice(invoice.amount, invoice.currency)}
                  </div>
                );
              }
              if (col.id === "payment_progress") {
                return (
                  <div className="bo-invoiceCardPaid" key={col.id} data-testid={`facturas-invoice-card-paid-${invoice.id}`} data-slot="facturas-invoice-card-paid">
                    <div className="bo-invoiceCardPaidBar" data-slot="facturas-invoice-card-paid-bar">
                      <span className={`bo-invoiceCardPaidFill${percentPaid >= 100 ? " is-complete" : ""}`} style={{ width: `${percentPaid}%` }} data-slot="facturas-invoice-card-paid-fill" />
                    </div>
                    <span className="bo-invoiceCardPaidText" data-slot="facturas-invoice-card-paid-text">
                      {formatPrice(paid, invoice.currency)} / {formatPrice(total, invoice.currency)}
                    </span>
                  </div>
                );
              }
              return (
                <div className="bo-invoiceCardRow" key={col.id} data-testid={`facturas-invoice-card-col-${col.id}-${invoice.id}`} data-slot={`facturas-invoice-card-col-${col.id}`}>
                  <col.icon size={11} aria-hidden="true" />
                  <span className="bo-invoiceCardRowLabel" data-slot={`facturas-invoice-card-col-label-${col.id}`}>{col.label}</span>
                  <span className="bo-invoiceCardRowValue" data-slot={`facturas-invoice-card-col-value-${col.id}`}>{invoiceColumnValue(invoice, col.id)}</span>
                </div>
              );
            })}
          </article>
        );
      })}
    </div>
  );
}
