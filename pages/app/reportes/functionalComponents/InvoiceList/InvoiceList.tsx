import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "../../../../../api/types";
import { Card } from "../../../../../ui/shell/Card";

interface Invoice {
  id: number;
  invoice_number: string | null;
  customer_name: string;
  invoice_date: string;
  base_amount: number;
  iva_rate: number;
  iva_amount: number;
  total: number;
  is_credit_note: boolean;
}

interface InvoiceListProps {
  invoices: Invoice[];
  expanded: boolean;
  onToggle: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function InvoiceList({ invoices, expanded, onToggle }: InvoiceListProps) {
  return (
    <Card variant="tailwind" data-ui="invoice-list">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-[var(--bo-surface-2)] hover:bg-[var(--bo-surface-3)]"
        data-ui="toggle-btn"
      >
        <span className="text-sm font-medium text-[var(--bo-text)]" data-ui="count-label">Lista de facturas ({invoices.length})</span>
        {expanded ? <ChevronUp className="w-5 h-5 text-[var(--bo-muted)]" /> : <ChevronDown className="w-5 h-5 text-[var(--bo-muted)]" />}
      </button>
      {expanded && (
        <table className="min-w-full divide-y divide-[var(--bo-border)]" data-ui="invoice-table">
          <thead className="bg-[var(--bo-surface-2)]" data-slot="invoiceList-bg-[var(--bo-surface-2)]">
            <tr data-slot="invoiceList-tr">
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Factura</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Base</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">IVA</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">IVA Importe</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Total</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Tipo</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="invoiceList-divide-[var(--bo-border)]">
            {invoices.map((inv, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-ui="invoice-row">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--bo-text)]" data-ui="invoice-number">{inv.invoice_number || ` #${inv.id}`}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-ui="customer-name">{inv.customer_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-ui="invoice-date">{formatDate(inv.invoice_date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="base-amount">{formatCurrency(inv.base_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-[var(--bo-muted)]" data-ui="iva-rate">{inv.iva_rate}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="iva-amount">{formatCurrency(inv.iva_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)] font-semibold" data-ui="total">{formatCurrency(inv.total, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center" data-ui="invoice-type">
                  {inv.is_credit_note ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]" data-slot="invoiceList-text-[var(--bo-color-warning)]">NC</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-[color-mix(in_srgb,var(--bo-accent)_18%,transparent)] text-[var(--bo-accent)]" data-slot="invoiceList-text-[var(--bo-accent)]">Factura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
