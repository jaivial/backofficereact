import React from "react";
import { formatCurrency } from "../../../../../api/types";
import { Card } from "../../../../../ui/shell/Card";

interface IVABreakdownItem {
  iva_rate: number;
  base_amount: number;
  iva_amount: number;
  invoice_count: number;
  credit_note_count: number;
  credit_note_base: number;
  credit_note_iva: number;
}

interface IVABreakdownTableProps {
  breakdown: IVABreakdownItem[];
  summary: {
    total_base: number;
    total_iva: number;
    total: number;
    invoice_count: number;
    credit_note_count: number;
    credit_note_base: number;
    credit_note_iva: number;
  };
  includeCreditNotes: boolean;
}

export function IVABreakdownTable({ breakdown, summary, includeCreditNotes }: IVABreakdownTableProps) {
  return (
    <Card variant="tailwind" data-ui="iva-breakdown-table">
      <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="iVABreakdownTable-divide-[var(--bo-border)]">
        <thead className="bg-[var(--bo-surface-2)]" data-slot="iVABreakdownTable-bg-[var(--bo-surface-2)]">
          <tr data-slot="iVABreakdownTable-tr">
            <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Tipo IVA</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Base</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">IVA</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Total</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Facturas</th>
            {includeCreditNotes && (
              <>
                <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Notas Cred.</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">Base NC</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase tracking-wider" data-slot="iVABreakdownTable-tracking-wider">IVA NC</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="iVABreakdownTable-divide-[var(--bo-border)]">
          {breakdown.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-ui="breakdown-row">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--bo-text)]" data-ui="iva-rate">{item.iva_rate}%</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="base-amount">{formatCurrency(item.base_amount, "EUR")}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="iva-amount">{formatCurrency(item.iva_amount, "EUR")}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-text)] font-semibold" data-ui="total">{formatCurrency(item.base_amount + item.iva_amount, "EUR")}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-[var(--bo-muted)]" data-ui="invoice-count">{item.invoice_count}</td>
              {includeCreditNotes && (
                <>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-[var(--bo-muted)]" data-ui="credit-note-count">{item.credit_note_count}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-muted)]" data-ui="credit-note-base">{formatCurrency(item.credit_note_base, "EUR")}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-[var(--bo-muted)]" data-ui="credit-note-iva">{formatCurrency(item.credit_note_iva, "EUR")}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-[var(--bo-surface-3)]">
          <tr data-slot="iVABreakdownTable-tr">
            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">TOTAL</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{formatCurrency(summary.total_base, "EUR")}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{formatCurrency(summary.total_iva, "EUR")}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{formatCurrency(summary.total, "EUR")}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{summary.invoice_count}</td>
            {includeCreditNotes && (
              <>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{summary.credit_note_count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{formatCurrency(summary.credit_note_base, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-[var(--bo-text)]" data-slot="iVABreakdownTable-text-[var(--bo-text)]">{formatCurrency(summary.credit_note_iva, "EUR")}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </Card>
  );
}
