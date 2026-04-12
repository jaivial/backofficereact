import React from "react";
import { formatCurrency } from "../../../../../api/types";

interface QuarterlyBreakdownItem {
  quarterLabel: string;
  start_date: string;
  end_date: string;
  base_amount: number;
  iva_amount: number;
  total: number;
  invoice_count: number;
  credit_note_count: number;
}

interface QuarterlyBreakdownTableProps {
  quarterlyBreakdown: QuarterlyBreakdownItem[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function QuarterlyBreakdownTable({ quarterlyBreakdown }: QuarterlyBreakdownTableProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" data-ui="quarterly-table">
      <table className="min-w-full divide-y divide-gray-200" data-slot="quarterlyBreakdownTable-divide-gray-200">
        <thead className="bg-gray-50" data-slot="quarterlyBreakdownTable-bg-gray-50">
          <tr data-slot="quarterlyBreakdownTable-tr">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Trimestre</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Periodo</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Base</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">IVA</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Total</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Facturas</th>
            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="quarterlyBreakdownTable-tracking-wider">Notas Cred.</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200" data-slot="quarterlyBreakdownTable-divide-gray-200">
          {quarterlyBreakdown.length > 0 ? (
            quarterlyBreakdown.map((item, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"} data-ui="quarterly-row">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" data-ui="quarter-label">{item.quarterLabel}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" data-ui="period">{formatDate(item.start_date)} - {formatDate(item.end_date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900" data-ui="base-amount">{formatCurrency(item.base_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900" data-ui="iva-amount">{formatCurrency(item.iva_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold" data-ui="total">{formatCurrency(item.total, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600" data-ui="invoice-count">{item.invoice_count}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600" data-ui="credit-note-count">{item.credit_note_count}</td>
              </tr>
            ))
          ) : (
            <tr data-slot="quarterlyBreakdownTable-tr">
              <td colSpan={7} className="px-6 py-8 text-center text-gray-500" data-ui="no-data">
                No hay datos trimestrales disponibles. Genera un reporte para ver el desglose.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
