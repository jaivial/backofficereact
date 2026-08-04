import React, { useCallback, useMemo, useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { CustomerStatement } from "../../../api/types";
import { formatCurrency } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Card } from "../../../ui/shell/Card";
import { EmptyState } from "../../../ui/feedback/EmptyState";
import { ExportButtonPair } from "../../../ui/actions/ExportButtonPair";
import { FileText, Calendar, Filter, RefreshCw, DollarSign, Receipt, CreditCard, Download, FileSpreadsheet, User } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type PageData = {
  customers: { name: string; email?: string; dni_cif?: string }[];
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatNumber(num: number): string {
  return num.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const errorToast = useErrorToast();

  // State
  const [customers, setCustomers] = useState<{ name: string; email?: string; dni_cif?: string }[]>(data.customers || []);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerStatement, setCustomerStatement] = useState<CustomerStatement | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Initialize default dates
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStatementDateFrom(firstDayOfMonth.toISOString().split("T")[0]);
    setStatementDateTo(lastDayOfMonth.toISOString().split("T")[0]);
  }, []);

  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");

  // Load customers
  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await api.taxReports.listCustomersWithInvoices();
      if (res.success && res.customers) {
        setCustomers(res.customers);
      }
    } catch (e) {
      errorToast.show("Error al cargar clientes");
    } finally {
      setCustomersLoading(false);
    }
  }, [api, errorToast]);

  // Generate customer statement
  const handleGenerateCustomerStatement = useCallback(async () => {
    if (!selectedCustomer) {
      errorToast.show("Por favor, selecciona un cliente");
      return;
    }
    if (!statementDateFrom || !statementDateTo) {
      errorToast.show("Por favor, selecciona un rango de fechas");
      return;
    }

    setCustomerLoading(true);
    try {
      const res = await api.taxReports.getCustomerStatement({
        customer_name: selectedCustomer,
        date_from: statementDateFrom,
        date_to: statementDateTo,
      });
      if (res.success && res.statement) {
        setCustomerStatement(res.statement);
        pushToast("Estado de cuenta generado correctamente", "success");
      } else {
        const msg = "message" in res ? res.message : undefined;
        errorToast.show(msg || "Error al generar el estado de cuenta");
      }
    } catch (e) {
      errorToast.show("Error al conectar con el servidor");
    } finally {
      setCustomerLoading(false);
    }
  }, [selectedCustomer, statementDateFrom, statementDateTo, api, errorToast, pushToast]);

  // Export to PDF
  const handleExportPDF = useCallback(async () => {
    if (!customerStatement) return;

    setExporting(true);
    try {
      const doc = new jsPDF();
      const currency = "EUR";

      // Header
      doc.setFontSize(18);
      doc.text("Estado de Cuenta", 14, 22);
      doc.setFontSize(10);
      doc.text(`Cliente: ${customerStatement.customer_name}`, 14, 30);
      if (customerStatement.customer_dni_cif) {
        doc.text(`DNI/CIF: ${customerStatement.customer_dni_cif}`, 14, 36);
      }
      if (customerStatement.customer_email) {
        doc.text(`Email: ${customerStatement.customer_email}`, 14, 42);
      }
      doc.text(`Periodo: ${formatDate(customerStatement.date_from)} - ${formatDate(customerStatement.date_to)}`, 14, 48);
      doc.text(`Fecha de generacion: ${new Date(customerStatement.generated_at).toLocaleString("es-ES")}`, 14, 54);

      let currentY = 65;

      // Opening Balance
      doc.setFontSize(12);
      doc.text("Saldo Inicial", 14, currentY);
      doc.setFontSize(10);
      doc.text(`${currency}${formatNumber(customerStatement.opening_balance)}`, 14, currentY + 6);
      currentY += 15;

      // Summary
      doc.setFontSize(12);
      doc.text("Resumen", 14, currentY);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Concepto", "Importe"]],
        body: [
          ["Total Facturado", `${currency}${formatNumber(customerStatement.summary.total_invoiced)}`],
          ["Total Pagado", `${currency}${formatNumber(customerStatement.summary.total_paid)}`],
          ["Total Pendiente", `${currency}${formatNumber(customerStatement.summary.total_pending)}`],
          ["Total Vencido", `${currency}${formatNumber(customerStatement.summary.total_overdue)}`],
          ["Facturas", `${customerStatement.summary.invoice_count}`],
          ["Pagos", `${customerStatement.summary.payment_count}`],
        ],
        theme: "striped",
      });

      currentY = (doc as any).lastAutoTable?.finalY + 15;

      // Invoices
      if (customerStatement.invoices.length > 0) {
        doc.setFontSize(12);
        doc.text("Facturas", 14, currentY);

        const invoiceBody = customerStatement.invoices.map(inv => [
          inv.invoice_number || `#${inv.id}`,
          formatDate(inv.invoice_date),
          inv.description,
          `${currency}${formatNumber(inv.total)}`,
          inv.is_credit_note ? "NC" : inv.status,
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [["Factura", "Fecha", "Descripcion", "Importe", "Tipo/Estado"]],
          body: invoiceBody,
          theme: "striped",
        });

        currentY = (doc as any).lastAutoTable?.finalY + 15;
      }

      // Payments
      if (customerStatement.payments.length > 0) {
        doc.setFontSize(12);
        doc.text("Pagos", 14, currentY);

        const paymentBody = customerStatement.payments.map(pay => [
          pay.invoice_number || `#${pay.invoice_id}`,
          formatDate(pay.payment_date),
          pay.payment_method,
          `${currency}${formatNumber(pay.amount)}`,
        ]);

        autoTable(doc, {
          startY: currentY + 5,
          head: [["Factura", "Fecha", "Metodo", "Importe"]],
          body: paymentBody,
          theme: "striped",
        });

        currentY = (doc as any).lastAutoTable?.finalY + 15;
      }

      // Closing Balance
      doc.setFontSize(12);
      doc.text("Saldo Final", 14, currentY);
      doc.setFontSize(10);
      doc.text(`${currency}${formatNumber(customerStatement.closing_balance)}`, 14, currentY + 6);

      // Footer
      doc.setFontSize(8);
      doc.text("Generado por Villa Carmen Backoffice", 14, 285);

      const safeName = customerStatement.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
      doc.save(`estado_cuenta_${safeName}_${statementDateFrom}_${statementDateTo}.pdf`);
      pushToast("PDF exportado correctamente", "success");
    } catch (e) {
      errorToast.show("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  }, [customerStatement, statementDateFrom, statementDateTo, errorToast, pushToast]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    if (!customerStatement) return;

    setExporting(true);
    try {
      const lines: string[] = [];

      lines.push("ESTADO DE CUENTA");
      lines.push(`Cliente,${customerStatement.customer_name}`)
      if (customerStatement.customer_dni_cif) {
        lines.push(`DNI/CIF,${customerStatement.customer_dni_cif}`);
      }
      if (customerStatement.customer_email) {
        lines.push(`Email,${customerStatement.customer_email}`);
      }
      lines.push(`Periodo,${customerStatement.date_from},${customerStatement.date_to}`);
      lines.push(`Fecha generacion,${customerStatement.generated_at}`);
      lines.push("");

      lines.push("RESUMEN");
      lines.push(`Saldo inicial,${formatNumber(customerStatement.opening_balance)}`);
      lines.push(`Total facturado,${formatNumber(customerStatement.summary.total_invoiced)}`);
      lines.push(`Total pagado,${formatNumber(customerStatement.summary.total_paid)}`);
      lines.push(`Total pendiente,${formatNumber(customerStatement.summary.total_pending)}`);
      lines.push(`Total vencido,${formatNumber(customerStatement.summary.total_overdue)}`);
      lines.push(`Saldo final,${formatNumber(customerStatement.closing_balance)}`);
      lines.push("");

      lines.push("FACTURAS");
      lines.push("Numero,Fecha,Descripcion,Importe,IVA,Tipo,Estado");
      customerStatement.invoices.forEach(inv => {
        lines.push(`${inv.invoice_number || ""},${inv.invoice_date},${inv.description},${inv.total},${inv.iva_amount},${inv.is_credit_note ? "NC" : "Factura"},${inv.status}`);
      });
      lines.push("");

      lines.push("PAGOS");
      lines.push("Factura,Fecha,Metodo,Importe,Notas");
      customerStatement.payments.forEach(pay => {
        lines.push(`${pay.invoice_number || ""},${pay.payment_date},${pay.payment_method},${pay.amount},${pay.notes || ""}`);
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = customerStatement.customer_name.replace(/[^a-zA-Z0-9]/g, "_");
      link.href = url;
      link.download = `estado_cuenta_${safeName}_${statementDateFrom}_${statementDateTo}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      pushToast("CSV exportado correctamente", "success");
    } catch (e) {
      errorToast.show("Error al exportar CSV");
    } finally {
      setExporting(false);
    }
  }, [customerStatement, statementDateFrom, statementDateTo, errorToast, pushToast]);

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6" data-slot="estado-cuenta-page">
      <div className="flex items-center justify-between mb-6" data-slot="estado-cuenta-page-header">
        <div data-slot="estado-cuenta-title-group">
          <h1 className="text-2xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">Estado de Cuenta</h1>
          <p className="text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Genera estados de cuenta para clientes</p>
        </div>
      </div>

      {/* Filters */}
      <Card variant="tailwind" padding className="mb-6" data-slot="estado-cuenta-filters-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-slot="estado-cuenta-filters-grid">
          {/* Customer Select */}
          <div data-slot="estado-cuenta-customer-field">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="estado-cuenta-mb-1">Cliente</label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                if (e.target.value && customers.length === 0) {
                  loadCustomers();
                }
              }}
              className="bo-input w-full"
              data-testid="estado-cuenta-customer-select"
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} {c.dni_cif ? `(${c.dni_cif})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div data-slot="estado-cuenta-date-from-field">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="estado-cuenta-mb-1">Desde</label>
            <input
              type="date"
              value={statementDateFrom}
              onChange={(e) => setStatementDateFrom(e.target.value)}
              className="bo-input w-full"
              data-testid="estado-cuenta-date-from"
            />
          </div>

          {/* Date to */}
          <div data-slot="estado-cuenta-date-to-field">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="estado-cuenta-mb-1">Hasta</label>
            <input
              type="date"
              value={statementDateTo}
              onChange={(e) => setStatementDateTo(e.target.value)}
              className="bo-input w-full"
              data-testid="estado-cuenta-date-to"
            />
          </div>

          {/* Load Customers */}
          <div className="flex items-end" data-slot="estado-cuenta-load-customers-action">
            <button
              onClick={loadCustomers}
              disabled={customersLoading}
              className="bo-btn bo-btn--secondary flex items-center gap-2 disabled:opacity-50"
              data-testid="estado-cuenta-load-customers-button"
            >
              {customersLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              Cargar Clientes
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4" data-slot="estado-cuenta-actions-bar">
          <button
            onClick={handleGenerateCustomerStatement}
            disabled={customerLoading || !selectedCustomer}
            className="bo-btn bo-btn--primary flex items-center gap-2 disabled:opacity-50"
            data-testid="estado-cuenta-generate-statement-button"
          >
            {customerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Generar Estado de Cuenta
          </button>

          {customerStatement && (
            <ExportButtonPair
              onExportPdf={handleExportPDF}
              onExportExcel={handleExportCSV}
              pdfLabel="Exportar PDF"
              excelLabel="Exportar Excel"
            />
          )}
        </div>
      </Card>

      {/* Statement Content */}
      {customerStatement ? (
        <>
          {/* Customer Info */}
          <Card variant="tailwind" padding className="mb-6" data-slot="estado-cuenta-customer-info-card">
            <h3 className="text-lg font-semibold text-[var(--bo-text)] mb-4" data-slot="estado-cuenta-customer-info-title">Informacion del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-slot="estado-cuenta-customer-info-grid">
              <div data-slot="estado-cuenta-customer-name-field">
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Nombre</span>
                <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{customerStatement.customer_name}</p>
              </div>
              {customerStatement.customer_dni_cif && (
                <div data-slot="estado-cuenta-customer-dni-field">
                  <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">DNI/CIF</span>
                  <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{customerStatement.customer_dni_cif}</p>
                </div>
              )}
              {customerStatement.customer_email && (
                <div data-slot="estado-cuenta-customer-email-field">
                  <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Email</span>
                  <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{customerStatement.customer_email}</p>
                </div>
              )}
              <div data-slot="estado-cuenta-customer-period-field">
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Periodo</span>
                <p className="text-lg font-medium text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
              </div>
            </div>
          </Card>

          {/* Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" data-slot="estado-cuenta-balance-summary-grid">
            <Card variant="tailwind" padding data-slot="estado-cuenta-balance-opening-card">
              <div className="flex items-center gap-2 mb-2" data-slot="estado-cuenta-balance-opening-header">
                <DollarSign className="w-5 h-5 text-[var(--bo-muted)]" />
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Saldo Inicial</span>
              </div>
              <p className="text-xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(customerStatement.opening_balance, "EUR")}</p>
            </Card>
            <Card variant="tailwind" padding data-slot="estado-cuenta-balance-invoiced-card">
              <div className="flex items-center gap-2 mb-2" data-slot="estado-cuenta-balance-invoiced-header">
                <Receipt className="w-5 h-5 text-[var(--bo-accent)]" />
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Total Facturado</span>
              </div>
              <p className="text-xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(customerStatement.summary.total_invoiced, "EUR")}</p>
            </Card>
            <Card variant="tailwind" padding data-slot="estado-cuenta-balance-paid-card">
              <div className="flex items-center gap-2 mb-2" data-slot="estado-cuenta-balance-paid-header">
                <CreditCard className="w-5 h-5 text-[var(--bo-color-success)]" />
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Total Pagado</span>
              </div>
              <p className="text-xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(customerStatement.summary.total_paid, "EUR")}</p>
            </Card>
            <Card variant="tailwind" padding data-slot="estado-cuenta-balance-pending-card">
              <div className="flex items-center gap-2 mb-2" data-slot="estado-cuenta-balance-pending-header">
                <Calendar className="w-5 h-5 text-[var(--bo-color-warning)]" />
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Pendiente</span>
              </div>
              <p className="text-xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(customerStatement.summary.total_pending, "EUR")}</p>
            </Card>
            <Card variant="tailwind" padding data-slot="estado-cuenta-balance-final-card">
              <div className="flex items-center gap-2 mb-2" data-slot="estado-cuenta-balance-final-header">
                <DollarSign className="w-5 h-5 text-[var(--bo-color-danger)]" />
                <span className="text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">Saldo Final</span>
              </div>
              <p className="text-xl font-bold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(customerStatement.closing_balance, "EUR")}</p>
            </Card>
          </div>

          {/* Invoices and Payments Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-slot="estado-cuenta-tables-grid">
            {/* Invoices */}
            <Card variant="tailwind" className="overflow-hidden" data-slot="estado-cuenta-invoices-card">
              <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-slot="estado-cuenta-invoices-header">
                <h3 className="text-lg font-semibold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">Facturas ({customerStatement.invoices.length})</h3>
              </div>
              {customerStatement.invoices.length > 0 ? (
                <div className="overflow-x-auto" data-slot="estado-cuenta-invoices-table-wrapper">
                  <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="estado-cuenta-divide-[var(--bo-border)]">
                    <thead className="bg-[var(--bo-surface-2)]" data-slot="estado-cuenta-bg-[var(--bo-surface-2)]">
                      <tr data-slot="estado-cuenta-tr">
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Importe</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="estado-cuenta-divide-[var(--bo-border)]">
                      {customerStatement.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="estado-cuenta-tr">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">
                            {inv.invoice_number || `#${inv.id}`}
                            {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]">NC</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">{formatDate(inv.invoice_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(inv.total, "EUR")}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center" data-slot="estado-cuenta-text-center">
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
                <div className="p-6 text-center text-[var(--bo-muted)]" data-slot="estado-cuenta-invoices-empty">
                  No hay facturas en este periodo
                </div>
              )}
            </Card>

            {/* Payments */}
            <Card variant="tailwind" className="overflow-hidden" data-slot="estado-cuenta-payments-card">
              <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-slot="estado-cuenta-payments-header">
                <h3 className="text-lg font-semibold text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">Pagos ({customerStatement.payments.length})</h3>
              </div>
              {customerStatement.payments.length > 0 ? (
                <div className="overflow-x-auto" data-slot="estado-cuenta-payments-table-wrapper">
                  <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="estado-cuenta-divide-[var(--bo-border)]">
                    <thead className="bg-[var(--bo-surface-2)]" data-slot="estado-cuenta-bg-[var(--bo-surface-2)]">
                      <tr data-slot="estado-cuenta-tr">
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Metodo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="estado-cuenta-uppercase">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="estado-cuenta-divide-[var(--bo-border)]">
                      {customerStatement.payments.map((pay, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="estado-cuenta-tr">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">{formatDate(pay.payment_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-[var(--bo-muted)]" data-slot="estado-cuenta-text-[var(--bo-muted)]">{pay.payment_method}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-[var(--bo-text)]" data-slot="estado-cuenta-text-[var(--bo-text)]">{formatCurrency(pay.amount, "EUR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-[var(--bo-muted)]" data-slot="estado-cuenta-payments-empty">
                  No hay pagos en este periodo
                </div>
              )}
            </Card>
          </div>
        </>
      ) : (
        <EmptyState variant="tailwind" data-slot="estado-cuenta-empty-state"
          icon={<Receipt className="w-12 h-12 text-[var(--bo-faint)] mx-auto mb-4" />}
          title="Sin estado de cuenta"
          description="Selecciona un cliente y un periodo para generar el estado de cuenta"
        />
      )}
    </div>
  );
}
