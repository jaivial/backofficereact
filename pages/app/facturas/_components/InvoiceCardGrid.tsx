import { Calendar, FileText, Tag } from "lucide-react";
import type { Invoice } from "../../../../api/types";
import { INVOICE_STATUS_CONFIG } from "../types/invoice";
import { formatDate, formatPrice } from "../utils";

/**
 * Card grid alternative to the invoices table ("grid" display mode).
 * Every card opens the invoice details modal on click.
 * Coordination id: facturas_cards_v1
 */
export function InvoiceCardGrid({
  invoices,
  onOpenDetails,
}: {
  invoices: Invoice[];
  onOpenDetails: (invoice: Invoice) => void;
}) {
  return (
    <div className="bo-invoiceCards" data-testid="facturas-invoiceCards" data-slot="facturas-invoiceCards" data-coordination-id="facturas_cards_v1">
      {invoices.map((invoice) => {
        const status = INVOICE_STATUS_CONFIG[invoice.status] || { label: invoice.status, className: "" };
        const total = invoice.total ?? invoice.amount;
        const paid = invoice.paid_amount ?? 0;
        const percentPaid = total > 0 ? Math.min((paid / total) * 100, 100) : 0;
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
            <header className="bo-invoiceCardHead" data-testid={`facturas-invoice-card-head-${invoice.id}`} data-slot="facturas-invoice-card-head">
              <span className="bo-invoiceCardNumber" data-testid={`facturas-invoice-card-number-${invoice.id}`} data-slot="facturas-invoice-card-number">
                <FileText size={13} aria-hidden="true" />
                {invoice.invoice_number || `#${invoice.id}`}
              </span>
              <span data-testid={`facturas-invoice-card-status-${invoice.id}`} className={`bo-badge ${status.className}`} data-slot="facturas-invoice-card-status">{status.label}</span>
            </header>
            <div className="bo-invoiceCardClient" data-testid={`facturas-invoice-card-client-${invoice.id}`} data-slot="facturas-invoice-card-client">
              <span className="bo-invoiceCardClientName" data-slot="facturas-invoice-card-client-name">{invoice.customer_name}</span>
              {invoice.customer_surname ? (
                <span className="bo-tableCustomerSurname" data-slot="facturas-invoice-card-client-surname">{invoice.customer_surname}</span>
              ) : null}
            </div>
            <div className="bo-invoiceCardAmount" data-testid={`facturas-invoice-card-amount-${invoice.id}`} data-slot="facturas-invoice-card-amount">
              {formatPrice(invoice.amount, invoice.currency)}
            </div>
            <div className="bo-invoiceCardMeta" data-testid={`facturas-invoice-card-meta-${invoice.id}`} data-slot="facturas-invoice-card-meta">
              <span className="bo-invoiceCardType" data-testid={`facturas-invoice-card-type-${invoice.id}`} data-slot="facturas-invoice-card-type">
                <Tag size={11} aria-hidden="true" />
                {invoice.is_reservation ? "Reserva" : "Sin reserva"}
              </span>
              <span className="bo-invoiceCardDate" data-testid={`facturas-invoice-card-date-${invoice.id}`} data-slot="facturas-invoice-card-date">
                <Calendar size={12} aria-hidden="true" />
                {formatDate(invoice.invoice_date)}
              </span>
            </div>
            <div className="bo-invoiceCardPaid" data-testid={`facturas-invoice-card-paid-${invoice.id}`} data-slot="facturas-invoice-card-paid">
              <div className="bo-invoiceCardPaidBar" data-slot="facturas-invoice-card-paid-bar">
                <span className={`bo-invoiceCardPaidFill${percentPaid >= 100 ? " is-complete" : ""}`} style={{ width: `${percentPaid}%` }} data-slot="facturas-invoice-card-paid-fill" />
              </div>
              <span className="bo-invoiceCardPaidText" data-slot="facturas-invoice-card-paid-text">
                {formatPrice(paid, invoice.currency)} / {formatPrice(total, invoice.currency)}
              </span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
