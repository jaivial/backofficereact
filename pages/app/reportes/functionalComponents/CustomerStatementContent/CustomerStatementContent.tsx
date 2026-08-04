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
        <h3 className="text-lg font-semibold text-[var(--bo-text)] mb-4" data-ui="info-title">Informacion del Cliente</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-ui="info-grid">
          <div data-ui="name-info">
            <span className="text-sm text-[var(--bo-muted)]" data-slot="customerStatementContent-text-[var(--bo-muted)]">Nombre</span>
            <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">{customerStatement.customer_name}</p>
          </div>
          {customerStatement.customer_dni_cif && (
            <div data-ui="dni-info">
              <span className="text-sm text-[var(--bo-muted)]" data-slot="customerStatementContent-text-[var(--bo-muted)]">DNI/CIF</span>
              <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">{customerStatement.customer_dni_cif}</p>
            </div>
          )}
          {customerStatement.customer_email && (
            <div data-ui="email-info">
              <span className="text-sm text-[var(--bo-muted)]" data-slot="customerStatementContent-text-[var(--bo-muted)]">Email</span>
              <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">{customerStatement.customer_email}</p>
            </div>
          )}
          <div data-ui="period-info">
            <span className="text-sm text-[var(--bo-muted)]" data-slot="customerStatementContent-text-[var(--bo-muted)]">Periodo</span>
            <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
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
          <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-ui="table-header">
            <h3 className="text-lg font-semibold text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">Facturas ({customerStatement.invoices.length})</h3>
          </div>
          {customerStatement.invoices.length > 0 ? (
            <div className="overflow-x-auto" data-ui="table-scroll">
              <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="customerStatementContent-divide-[var(--bo-border)]">
                <thead className="bg-[var(--bo-surface-2)]" data-slot="customerStatementContent-bg-[var(--bo-surface-2)]">
                  <tr data-slot="customerStatementContent-tr">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Importe</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="customerStatementContent-divide-[var(--bo-border)]">
                  {customerStatement.invoices.map((inv, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-ui="invoice-row">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-text)]" data-ui="invoice-number">
                        {inv.invoice_number || `#${inv.id}`}
                        {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]">NC</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-ui="invoice-date">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="invoice-total">{formatCurrency(inv.total, "EUR")}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-center" data-ui="invoice-status">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          inv.status === "pagada" ? "bg-green-100 text-[var(--bo-color-success)]" :
                          inv.status === "pendiente" ? "bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]" :
                          inv.status === "enviada" ? "bg-[color-mix(in_srgb,var(--bo-accent)_18%,transparent)] text-[var(--bo-accent)]" :
                          "bg-[var(--bo-surface-3)] text-[var(--bo-text)]"
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
            <div className="p-6 text-center text-[var(--bo-muted)]" data-ui="no-invoices">No hay facturas en este periodo</div>
          )}
        </Card>

        <Card variant="tailwind" data-ui="payments-table">
          <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-ui="table-header">
            <h3 className="text-lg font-semibold text-[var(--bo-text)]" data-slot="customerStatementContent-text-[var(--bo-text)]">Pagos ({customerStatement.payments.length})</h3>
          </div>
          {customerStatement.payments.length > 0 ? (
            <div className="overflow-x-auto" data-ui="table-scroll">
              <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="customerStatementContent-divide-[var(--bo-border)]">
                <thead className="bg-[var(--bo-surface-2)]" data-slot="customerStatementContent-bg-[var(--bo-surface-2)]">
                  <tr data-slot="customerStatementContent-tr">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Metodo</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="customerStatementContent-uppercase">Importe</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="customerStatementContent-divide-[var(--bo-border)]">
                  {customerStatement.payments.map((pay, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-ui="payment-row">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-text)]" data-ui="payment-invoice">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-ui="payment-date">{formatDate(pay.payment_date)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-ui="payment-method">{pay.payment_method}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-ui="payment-amount">{formatCurrency(pay.amount, "EUR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-[var(--bo-muted)]" data-ui="no-payments">No hay pagos en este periodo</div>
          )}
        </Card>
      </div>
    </>
  );
}
