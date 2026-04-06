import React from "react";
import { StatCard } from "../../../../../ui/widgets/StatCard";
import { formatCurrency } from "../../../../../api/types";

interface IVASummaryProps {
  report: {
    summary: {
      total_base: number;
      total_iva: number;
      total: number;
      invoice_count: number;
      credit_note_count: number;
      credit_note_base: number;
      credit_note_iva: number;
      net_base: number;
      net_iva: number;
      net_total: number;
    };
  };
  includeCreditNotes: boolean;
}

export function IVASummary({ report, includeCreditNotes }: IVASummaryProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-ui="iva-summary-cards">
        <StatCard title="Base Imponible" value={formatCurrency(report.summary.total_base, "EUR")} icon="file-text" />
        <StatCard title="IVA Acumulado" value={formatCurrency(report.summary.total_iva, "EUR")} icon="calendar" />
        <StatCard title="Total" value={formatCurrency(report.summary.total, "EUR")} icon="trending-up" />
        <StatCard title="Facturas" value={String(report.summary.invoice_count)} icon="users" />
      </div>

      {includeCreditNotes && report.summary.credit_note_count > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6" data-ui="credit-notes-summary">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3" data-ui="credit-notes-title">Notas de Credito</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-ui="credit-notes-grid">
            <div data-ui="cn-count">
              <span className="text-sm text-yellow-700">Cantidad</span>
              <p className="text-xl font-bold text-yellow-900">{report.summary.credit_note_count}</p>
            </div>
            <div data-ui="cn-base">
              <span className="text-sm text-yellow-700">Base</span>
              <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_base, "EUR")}</p>
            </div>
            <div data-ui="cn-iva">
              <span className="text-sm text-yellow-700">IVA</span>
              <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_iva, "EUR")}</p>
            </div>
            <div data-ui="cn-total">
              <span className="text-sm text-yellow-700">Total</span>
              <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_base + report.summary.credit_note_iva, "EUR")}</p>
            </div>
          </div>
        </div>
      )}

      {includeCreditNotes && report.summary.credit_note_count > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6" data-ui="net-total">
          <h3 className="text-lg font-semibold text-green-800 mb-3" data-ui="net-total-title">Total Neto (despues de notas de credito)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-ui="net-total-grid">
            <div data-ui="net-base">
              <span className="text-sm text-green-700">Base neta</span>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_base, "EUR")}</p>
            </div>
            <div data-ui="net-iva">
              <span className="text-sm text-green-700">IVA neto</span>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_iva, "EUR")}</p>
            </div>
            <div data-ui="net-total-amount">
              <span className="text-sm text-green-700">Total neto</span>
              <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_total, "EUR")}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
