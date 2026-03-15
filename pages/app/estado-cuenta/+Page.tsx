import React, { useCallback, useMemo, useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { CustomerStatement } from "../../../api/types";
import { formatCurrency } from "../../../api/types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
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
    <div className="bo-pageContainer--wide">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bo-text">Estado de Cuenta</h1>
          <p className="text-faint">Genera estados de cuenta para clientes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 grid-gap-4">
          {/* Customer Select */}
          <div>
            <label className="text-bo-sm font-semibold text-bo-muted">Cliente</label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                if (e.target.value && customers.length === 0) {
                  loadCustomers();
                }
              }}
              className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
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
          <div>
            <label className="text-bo-sm font-semibold text-bo-muted">Desde</label>
            <input
              type="date"
              value={statementDateFrom}
              onChange={(e) => setStatementDateFrom(e.target.value)}
              className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="text-bo-sm font-semibold text-bo-muted">Hasta</label>
            <input
              type="date"
              value={statementDateTo}
              onChange={(e) => setStatementDateTo(e.target.value)}
              className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors"
            />
          </div>

          {/* Load Customers */}
          <div className="flex items-end">
            <button
              onClick={loadCustomers}
              disabled={customersLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-bo-surface-2 text-bo-text text-sm font-bold transition-all hover:border-bo-primary hover:bg-bo-surface-2/80 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {customersLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              Cargar Clientes
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleGenerateCustomerStatement}
            disabled={customerLoading || !selectedCustomer}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed mx-auto"
          >
            {customerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Generar Estado de Cuenta
          </button>

          {customerStatement && (
            <>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/14 text-red-400 text-sm font-bold transition-all hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                Exportar PDF
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-green-500/35 bg-green-500/14 text-green-400 text-sm font-bold transition-all hover:border-green-500/50 hover:bg-green-500/20 disabled:opacity-55 disabled:cursor-not-allowed"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statement Content */}
      {customerStatement ? (
        <>
          {/* Customer Info */}
          <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4 mb-6">
            <h3 className="text-lg font-semibold text-bo-text mb-4">Informacion del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 grid-gap-4">
              <div>
                <span className="text-sm text-faint">Nombre</span>
                <p className="text-lg font-medium text-bo-text">{customerStatement.customer_name}</p>
              </div>
              {customerStatement.customer_dni_cif && (
                <div>
                  <span className="text-sm text-faint">DNI/CIF</span>
                  <p className="text-lg font-medium text-bo-text">{customerStatement.customer_dni_cif}</p>
                </div>
              )}
              {customerStatement.customer_email && (
                <div>
                  <span className="text-sm text-faint">Email</span>
                  <p className="text-lg font-medium text-bo-text">{customerStatement.customer_email}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-faint">Periodo</span>
                <p className="text-lg font-medium text-bo-text">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
              </div>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-5 grid-gap-4 mb-6">
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-faint" />
                <span className="text-sm text-faint">Saldo Inicial</span>
              </div>
              <p className="text-xl font-bold text-bo-text">{formatCurrency(customerStatement.opening_balance, "EUR")}</p>
            </div>
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="w-5 h-5" style={{ color: "var(--bo-color-info)" }} />
                <span className="text-sm text-faint">Total Facturado</span>
              </div>
              <p className="text-xl font-bold text-bo-text">{formatCurrency(customerStatement.summary.total_invoiced, "EUR")}</p>
            </div>
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5" style={{ color: "var(--bo-color-success)" }} />
                <span className="text-sm text-faint">Total Pagado</span>
              </div>
              <p className="text-xl font-bold text-bo-text">{formatCurrency(customerStatement.summary.total_paid, "EUR")}</p>
            </div>
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-5 h-5" style={{ color: "var(--bo-color-warning)" }} />
                <span className="text-sm text-faint">Pendiente</span>
              </div>
              <p className="text-xl font-bold text-bo-text">{formatCurrency(customerStatement.summary.total_pending, "EUR")}</p>
            </div>
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3 bo-card--p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5" style={{ color: "var(--bo-color-danger)" }} />
                <span className="text-sm text-faint">Saldo Final</span>
              </div>
              <p className="text-xl font-bold text-bo-text">{formatCurrency(customerStatement.closing_balance, "EUR")}</p>
            </div>
          </div>

          {/* Invoices and Payments Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 grid-gap-6">
            {/* Invoices */}
            <div className="rounded-bo-md bg-bo-surface-2 border border-white/6 shadow-bo-soft p-3">
              <div className="flex items-center justify-between p-3 border-b border-bo-border">
                <h3 className="text-lg font-semibold text-bo-text">Facturas ({customerStatement.invoices.length})</h3>
              </div>
              {customerStatement.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-bo-surface-2">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Importe</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-muted uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-bo-surface divide-y divide-gray-200">
                      {customerStatement.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bo-surface" : "bo-surface-2"}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-bo-text">
                            {inv.invoice_number || `#${inv.id}`}
                            {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 18%, transparent)", color: "var(--bo-color-warning)" }}>NC</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">{formatDate(inv.invoice_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-bo-text">{formatCurrency(inv.total, "EUR")}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span className="px-2 py-1 text-xs rounded-full" style={inv.status === "pagada" ? { backgroundColor: "color-mix(in srgb, var(--bo-color-success) 18%, transparent)", color: "var(--bo-color-success)" } : inv.status === "pendiente" ? { backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 18%, transparent)", color: "var(--bo-color-warning)" } : inv.status === "enviada" ? { backgroundColor: "color-mix(in srgb, var(--bo-color-info) 18%, transparent)", color: "var(--bo-color-info)" } : {}}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted">
                  No hay facturas en este periodo
                </div>
              )}
            </div>

            {/* Payments */}
            <div className="bg-bo-surface rounded-[var(--rounded-md)] shadow-soft border border overflow-hidden">
              <div className="px-6 py-4 border-b border bo-surface-2">
                <h3 className="text-lg font-semibold text-bo-text">Pagos ({customerStatement.payments.length})</h3>
              </div>
              {customerStatement.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-bo-surface-2">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-muted uppercase">Metodo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-muted uppercase">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="bg-bo-surface divide-y divide-gray-200">
                      {customerStatement.payments.map((pay, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bo-surface" : "bo-surface-2"}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-bo-text">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">{formatDate(pay.payment_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-muted">{pay.payment_method}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-bo-text">{formatCurrency(pay.amount, "EUR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted">
                  No hay pagos en este periodo
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-bo-surface rounded-[var(--rounded-md)] shadow-soft border border p-12 text-center">
          <Receipt className="w-12 h-12 text-faint mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bo-text mb-2">Sin estado de cuenta</h3>
          <p className="text-muted mb-4">Selecciona un cliente y un periodo para generar el estado de cuenta</p>
        </div>
      )}
    </div>
  );
}
