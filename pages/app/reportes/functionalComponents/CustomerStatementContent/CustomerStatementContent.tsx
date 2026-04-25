import React from "react";
import { StatCard } from "../../../../../ui/widgets/StatCard";
import { Card } from "../../../../../ui/shell/Card";
import { formatCurrency } from "../../../../../api/types";
import type { CustomerStatement } from "../../../../../api/types";

interface CustomerStatementContentProps {
  customerStatement: CustomerStatement;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function CustomerStatementContent({ customerStatement }: CustomerStatementContentProps) {
  return (
    <>
      <Card variant="tailwind" padding className="mb-6" data-ui="customer-info">
        <h3 className="text-lg font-semibold text-gray-900 mb-4" data-ui="info-title">Informacion del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-ui="info-grid">
          <div data-ui="name-info">
            <span className="text-sm text-gray-500" data-slot="customerStatementContent-text-gray-500">Nombre</span>
            <p className="text-lg font-medium text-gray-900" data-slot="customerStatementContent-text-gray-900">{customerStatement.customer_name}</p>
          </div>
          {customerStatement.customer_dni_cif && (
            <div data-ui="dni-info">
              <span className="text-sm text-gray-500" data-slot="customerStatementContent-text-gray-500">DNI/CIF</span>
              <p className="text-lg font-medium text-gray-900" data-slot="customerStatementContent-text-gray-900">{customerStatement.customer_dni_cif}</p>
            </div>
          )}
          {customerStatement.customer_email && (
            <div data-ui="email-info">
              <span className="text-sm text-gray-500" data-slot="customerStatementContent-text-gray-500">Email</span>
              <p className="text-lg font-medium text-gray-900" data-slot="customerStatementContent-text-gray-900">{customerStatement.customer_email}</p>
            </div>
          )}
          <div data-ui="period-info">
            <span className="text-sm text-gray-500" data-slot="customerStatementContent-text-gray-500">Periodo</span>
            <p className="text-lg font-medium text-gray-900" data-slot="customerStatementContent-text-gray-900">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" data-ui="balance-summary">
        <StatCard title="Saldo Inicial" value={formatCurrency(customerStatement.opening_balance, "EUR")} icon="calendar" />
        <StatCard title="Total Facturado" value={formatCurrency(customerStatement.summary.total_invoiced, "EUR")} icon="file-text" />
        <StatCard title="Total Pagado" value={formatCurrency(customerStatement.summary.total_paid, "EUR")} icon="check" />
        <StatCard title="Pendiente" value={formatCurrency(customerStatement.summary.total_pending, "EUR")} icon="clock" />
        <StatCard title="Saldo Final" value={formatCurrency(customerStatement.closing_balance, "EUR")} icon="trending-up" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-ui="tables-grid">
        <Card variant="tailwind" data-ui="invoices-table">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50" data-ui="table-header">
            <h3 className="text-lg font-semibold text-gray-900" data-slot="customerStatementContent-text-gray-900">Facturas ({customerStatement.invoices.length})</h3>
          </div>
          {customerStatement.invoices.length > 0 ? (
            <div className="overflow-x-auto" data-ui="table-scroll">
              <table className="min-w-full divide-y divide-gray-200" data-slot="customerStatementContent-divide-gray-200">
                <thead className="bg-gray-50" data-slot="customerStatementContent-bg-gray-50">
                  <tr data-slot="customerStatementContent-tr">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Importe</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200" data-slot="customerStatementContent-divide-gray-200">
                  {customerStatement.invoices.map((inv, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"} data-ui="invoice-row">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900" data-ui="invoice-number">
                        {inv.invoice_number || `#${inv.id}`}
                        {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">NC</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600" data-ui="invoice-date">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900" data-ui="invoice-total">{formatCurrency(inv.total, "EUR")}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center" data-ui="invoice-status">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          inv.status === "pagada" ? "bg-green-100 text-green-800" :
                          inv.status === "pendiente" ? "bg-yellow-100 text-yellow-800" :
                          inv.status === "enviada" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500" data-ui="no-invoices">No hay facturas en este periodo</div>
          )}
        </Card>

        <Card variant="tailwind" data-ui="payments-table">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50" data-ui="table-header">
            <h3 className="text-lg font-semibold text-gray-900" data-slot="customerStatementContent-text-gray-900">Pagos ({customerStatement.payments.length})</h3>
          </div>
          {customerStatement.payments.length > 0 ? (
            <div className="overflow-x-auto" data-ui="table-scroll">
              <table className="min-w-full divide-y divide-gray-200" data-slot="customerStatementContent-divide-gray-200">
                <thead className="bg-gray-50" data-slot="customerStatementContent-bg-gray-50">
                  <tr data-slot="customerStatementContent-tr">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Metodo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase" data-slot="customerStatementContent-uppercase">Importe</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200" data-slot="customerStatementContent-divide-gray-200">
                  {customerStatement.payments.map((pay, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"} data-ui="payment-row">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900" data-ui="payment-invoice">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600" data-ui="payment-date">{formatDate(pay.payment_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600" data-ui="payment-method">{pay.payment_method}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900" data-ui="payment-amount">{formatCurrency(pay.amount, "EUR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500" data-ui="no-payments">No hay pagos en este periodo</div>
          )}
        </Card>
      </div>
    </>
  );
}
