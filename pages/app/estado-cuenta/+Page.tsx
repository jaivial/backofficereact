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
      <div className="bo-flex bo-items-center bo-justify-between bo-mb-6">
        <div>
          <h1 className="bo-text-2xl bo-weight-bold bo-text">Estado de Cuenta</h1>
          <p className="bo-faint">Genera estados de cuenta para clientes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bo-card bo-card--p-4 bo-mb-6">
        <div className="bo-grid bo-grid-cols-1 md:bo-grid-cols-4 bo-grid-gap-4">
          {/* Customer Select */}
          <div>
            <label className="bo-label">Cliente</label>
            <select
              value={selectedCustomer}
              onChange={(e) => {
                setSelectedCustomer(e.target.value);
                if (e.target.value && customers.length === 0) {
                  loadCustomers();
                }
              }}
              className="bo-input"
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
            <label className="bo-label">Desde</label>
            <input
              type="date"
              value={statementDateFrom}
              onChange={(e) => setStatementDateFrom(e.target.value)}
              className="bo-input"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="bo-label">Hasta</label>
            <input
              type="date"
              value={statementDateTo}
              onChange={(e) => setStatementDateTo(e.target.value)}
              className="bo-input"
            />
          </div>

          {/* Load Customers */}
          <div className="bo-flex bo-items-end">
            <button
              onClick={loadCustomers}
              disabled={customersLoading}
              className="bo-btn bo-btn--secondary"
            >
              {customersLoading ? <RefreshCw className="bo-icon--sm bo-animate-spin" /> : <User className="bo-icon--sm" />}
              Cargar Clientes
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="bo-flex bo-gap-2 bo-mt-4">
          <button
            onClick={handleGenerateCustomerStatement}
            disabled={customerLoading || !selectedCustomer}
            className="bo-btn bo-btn--primary"
          >
            {customerLoading ? <RefreshCw className="bo-icon--sm bo-animate-spin" /> : <Receipt className="bo-icon--sm" />}
            Generar Estado de Cuenta
          </button>

          {customerStatement && (
            <>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="bo-btn bo-btn--danger"
              >
                <FileText className="bo-icon--sm" />
                Exportar PDF
              </button>
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="bo-btn bo-btn--success"
              >
                <FileSpreadsheet className="bo-icon--sm" />
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
          <div className="bo-card bo-card--p-4 bo-mb-6">
            <h3 className="bo-text-lg bo-weight-semibold bo-text bo-mb-4">Informacion del Cliente</h3>
            <div className="bo-grid bo-grid-cols-1 md:bo-grid-cols-2 bo-grid-gap-4">
              <div>
                <span className="bo-text-sm bo-faint">Nombre</span>
                <p className="bo-text-lg bo-weight-medium bo-text">{customerStatement.customer_name}</p>
              </div>
              {customerStatement.customer_dni_cif && (
                <div>
                  <span className="bo-text-sm bo-faint">DNI/CIF</span>
                  <p className="bo-text-lg bo-weight-medium bo-text">{customerStatement.customer_dni_cif}</p>
                </div>
              )}
              {customerStatement.customer_email && (
                <div>
                  <span className="bo-text-sm bo-faint">Email</span>
                  <p className="bo-text-lg bo-weight-medium bo-text">{customerStatement.customer_email}</p>
                </div>
              )}
              <div>
                <span className="bo-text-sm bo-faint">Periodo</span>
                <p className="bo-text-lg bo-weight-medium bo-text">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
              </div>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="bo-grid bo-grid-cols-1 md:bo-grid-cols-5 bo-grid-gap-4 bo-mb-6">
            <div className="bo-card bo-card--p-4">
              <div className="bo-flex bo-items-center bo-gap-2 bo-mb-2">
                <DollarSign className="bo-icon--md bo-faint" />
                <span className="bo-text-sm bo-faint">Saldo Inicial</span>
              </div>
              <p className="bo-text-xl bo-weight-bold bo-text">{formatCurrency(customerStatement.opening_balance, "EUR")}</p>
            </div>
            <div className="bo-card bo-card--p-4">
              <div className="bo-flex bo-items-center bo-gap-2 bo-mb-2">
                <Receipt className="bo-icon--md" style={{ color: "var(--bo-color-info)" }} />
                <span className="bo-text-sm bo-faint">Total Facturado</span>
              </div>
              <p className="bo-text-xl bo-weight-bold bo-text">{formatCurrency(customerStatement.summary.total_invoiced, "EUR")}</p>
            </div>
            <div className="bo-card bo-card--p-4">
              <div className="bo-flex bo-items-center bo-gap-2 bo-mb-2">
                <CreditCard className="bo-icon--md" style={{ color: "var(--bo-color-success)" }} />
                <span className="bo-text-sm bo-faint">Total Pagado</span>
              </div>
              <p className="bo-text-xl bo-weight-bold bo-text">{formatCurrency(customerStatement.summary.total_paid, "EUR")}</p>
            </div>
            <div className="bo-card bo-card--p-4">
              <div className="bo-flex bo-items-center bo-gap-2 bo-mb-2">
                <Calendar className="bo-icon--md" style={{ color: "var(--bo-color-warning)" }} />
                <span className="bo-text-sm bo-faint">Pendiente</span>
              </div>
              <p className="bo-text-xl bo-weight-bold bo-text">{formatCurrency(customerStatement.summary.total_pending, "EUR")}</p>
            </div>
            <div className="bo-card bo-card--p-4">
              <div className="bo-flex bo-items-center bo-gap-2 bo-mb-2">
                <DollarSign className="bo-icon--md" style={{ color: "var(--bo-color-danger)" }} />
                <span className="bo-text-sm bo-faint">Saldo Final</span>
              </div>
              <p className="bo-text-xl bo-weight-bold bo-text">{formatCurrency(customerStatement.closing_balance, "EUR")}</p>
            </div>
          </div>

          {/* Invoices and Payments Tables */}
          <div className="bo-grid bo-grid-cols-1 lg:bo-grid-cols-2 bo-grid-gap-6">
            {/* Invoices */}
            <div className="bo-card">
              <div className="bo-cardHeader">
                <h3 className="bo-text-lg bo-weight-semibold bo-text">Facturas ({customerStatement.invoices.length})</h3>
              </div>
              {customerStatement.invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bo-surface-2">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium bo-muted uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium bo-muted uppercase">Fecha</th>
                        <th className="px-4 py-3 text-right text-xs font-medium bo-muted uppercase">Importe</th>
                        <th className="px-4 py-3 text-center text-xs font-medium bo-muted uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bo-surface divide-y divide-gray-200">
                      {customerStatement.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bo-surface" : "bo-surface-2"}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm bo-text">
                            {inv.invoice_number || `#${inv.id}`}
                            {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--bo-color-warning) 18%, transparent)", color: "var(--bo-color-warning)" }}>NC</span>}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm bo-muted">{formatDate(inv.invoice_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right bo-text">{formatCurrency(inv.total, "EUR")}</td>
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
                <div className="p-6 text-center bo-muted">
                  No hay facturas en este periodo
                </div>
              )}
            </div>

            {/* Payments */}
            <div className="bo-surface rounded-[var(--bo-radius-md)] shadow-soft border bo-border overflow-hidden">
              <div className="px-6 py-4 border-b bo-border bo-surface-2">
                <h3 className="text-lg font-semibold bo-text">Pagos ({customerStatement.payments.length})</h3>
              </div>
              {customerStatement.payments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bo-surface-2">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium bo-muted uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-medium bo-muted uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-medium bo-muted uppercase">Metodo</th>
                        <th className="px-4 py-3 text-right text-xs font-medium bo-muted uppercase">Importe</th>
                      </tr>
                    </thead>
                    <tbody className="bo-surface divide-y divide-gray-200">
                      {customerStatement.payments.map((pay, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bo-surface" : "bo-surface-2"}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm bo-text">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm bo-muted">{formatDate(pay.payment_date)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm bo-muted">{pay.payment_method}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-right bo-text">{formatCurrency(pay.amount, "EUR")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center bo-muted">
                  No hay pagos en este periodo
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bo-surface rounded-[var(--bo-radius-md)] shadow-soft border bo-border p-12 text-center">
          <Receipt className="w-12 h-12 bo-faint mx-auto mb-4" />
          <h3 className="text-lg font-medium bo-text mb-2">Sin estado de cuenta</h3>
          <p className="bo-muted mb-4">Selecciona un cliente y un periodo para generar el estado de cuenta</p>
        </div>
      )}
    </div>
  );
}
