import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "../../../../../api/types";

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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden" data-ui="invoice-list">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
        data-ui="toggle-btn"
      >
        <span className="text-sm font-medium text-gray-900" data-ui="count-label">Lista de facturas ({invoices.length})</span>
        {expanded ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
      </button>
      {expanded && (
        <table className="min-w-full divide-y divide-gray-200" data-ui="invoice-table">
          <thead className="bg-gray-50" data-slot="invoiceList-bg-gray-50">
            <tr data-slot="invoiceList-tr">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Factura</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Fecha</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Base</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">IVA</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">IVA Importe</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Total</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" data-slot="invoiceList-tracking-wider">Tipo</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200" data-slot="invoiceList-divide-gray-200">
            {invoices.map((inv, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"} data-ui="invoice-row">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" data-ui="invoice-number">{inv.invoice_number || ` #${inv.id}`}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" data-ui="customer-name">{inv.customer_name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" data-ui="invoice-date">{formatDate(inv.invoice_date)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900" data-ui="base-amount">{formatCurrency(inv.base_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600" data-ui="iva-rate">{inv.iva_rate}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900" data-ui="iva-amount">{formatCurrency(inv.iva_amount, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold" data-ui="total">{formatCurrency(inv.total, "EUR")}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center" data-ui="invoice-type">
                  {inv.is_credit_note ? (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800" data-slot="invoiceList-text-yellow-800">NC</span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800" data-slot="invoiceList-text-blue-800">Factura</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
