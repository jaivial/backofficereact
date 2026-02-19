import React, { useCallback, useMemo, useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { TaxReport, TaxReportIVABreakdown, TaxReportQuarterlyBreakdown, TaxReportInvoiceItem, CustomerStatement, InvoicePayment } from "../../../api/types";
import { formatCurrency, CURRENCY_SYMBOLS, type CurrencyCode } from "../../../api/types";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList } from "../../../ui/nav/SimpleTabs";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { FileText, Filter, FileSpreadsheet, RefreshCw, ChevronDown, ChevronUp, User, Receipt } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

type PageData = {
  report: TaxReport | null;
  quarterlyBreakdown: TaxReportQuarterlyBreakdown[];
  currentYear: number;
  error: string | null;
  customers?: { name: string; email?: string; dni_cif?: string }[];
};

type DatePreset = "this_quarter" | "last_quarter" | "this_year" | "last_year" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "this_quarter", label: "Este trimestre" },
  { value: "last_quarter", label: "Trimestre anterior" },
  { value: "this_year", label: "Este ano" },
  { value: "last_year", label: "Ano anterior" },
  { value: "custom", label: "Personalizado" },
];

function getQuarterDates(preset: DatePreset, currentYear: number): { dateFrom: string; dateTo: string; quarter?: string } {
  const now = new Date();
  const currentQuarter = Math.floor((now.getMonth() + 3) / 3);

  switch (preset) {
    case "this_quarter": {
      const quarter = currentQuarter;
      const startMonth = (quarter - 1) * 3;
      const dateFrom = `${currentYear}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const dateTo = new Date(currentYear, startMonth + 3, 0).toISOString().split("T")[0];
      return { dateFrom, dateTo, quarter: `${currentYear}-Q${quarter}` };
    }
    case "last_quarter": {
      const quarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
      const year = currentQuarter === 1 ? currentYear - 1 : currentYear;
      const startMonth = (quarter - 1) * 3;
      const dateFrom = `${year}-${String(startMonth + 1).padStart(2, "0")}-01`;
      const dateTo = new Date(year, startMonth + 3, 0).toISOString().split("T")[0];
      return { dateFrom, dateTo, quarter: `${year}-Q${quarter}` };
    }
    case "this_year": {
      return { dateFrom: `${currentYear}-01-01`, dateTo: `${currentYear}-12-31` };
    }
    case "last_year": {
      const year = currentYear - 1;
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
    }
    default:
      return { dateFrom: `${currentYear}-01-01`, dateTo: `${currentYear}-12-31` };
  }
}

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

  const currentYear = data.currentYear || new Date().getFullYear();

  // State
  const [report, setReport] = useState<TaxReport | null>(data.report);
  const [loading, setLoading] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_quarter");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState(false);

  // Customer Statement State
  const [customers, setCustomers] = useState<{ name: string; email?: string; dni_cif?: string }[]>(data.customers || []);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerStatement, setCustomerStatement] = useState<CustomerStatement | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [statementDateFrom, setStatementDateFrom] = useState("");
  const [statementDateTo, setStatementDateTo] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);

  // Initialize dates from report or default
  useEffect(() => {
    if (data.report) {
      setDateFrom(data.report.date_from);
      setDateTo(data.report.date_to);
    } else {
      const { dateFrom: df, dateTo: dt } = getQuarterDates("this_quarter", currentYear);
      setDateFrom(df);
      setDateTo(dt);
    }
  }, [data.report, currentYear]);

  // Initialize default statement dates
  useEffect(() => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setStatementDateFrom(firstDayOfMonth.toISOString().split("T")[0]);
    setStatementDateTo(lastDayOfMonth.toISOString().split("T")[0]);
  }, []);

  // Load customers with invoices
  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await api.taxReports.listCustomersWithInvoices();
      if (res.success && res.customers) {
        setCustomers(res.customers);
      }
    } catch (e) {
      // Silently handle
    } finally {
      setCustomersLoading(false);
    }
  }, [api]);

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
        pushToast({ kind: "success", title: "Estado de cuenta generado correctamente" });
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

  // Export customer statement to PDF
  const handleExportCustomerStatementPDF = useCallback(async () => {
    if (!customerStatement) return;

    setExporting(true);
    try {
      const doc = new jsPDF();
      const currency = CURRENCY_SYMBOLS.EUR;

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
      pushToast({ kind: "success", title: "PDF exportado correctamente" });
    } catch (e) {
      errorToast.show("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  }, [customerStatement, statementDateFrom, statementDateTo, errorToast, pushToast]);

  // Export customer statement to CSV
  const handleExportCustomerStatementCSV = useCallback(() => {
    if (!customerStatement) return;

    setExporting(true);
    try {
      const lines: string[] = [];

      // Header
      lines.push("ESTADO DE CUENTA");
      lines.push(`Cliente,${customerStatement.customer_name}`);
      if (customerStatement.customer_dni_cif) {
        lines.push(`DNI/CIF,${customerStatement.customer_dni_cif}`);
      }
      if (customerStatement.customer_email) {
        lines.push(`Email,${customerStatement.customer_email}`);
      }
      lines.push(`Periodo,${customerStatement.date_from},${customerStatement.date_to}`);
      lines.push(`Fecha generacion,${customerStatement.generated_at}`);
      lines.push("");

      // Summary
      lines.push("RESUMEN");
      lines.push(`Saldo inicial,${formatNumber(customerStatement.opening_balance)}`);
      lines.push(`Total facturado,${formatNumber(customerStatement.summary.total_invoiced)}`);
      lines.push(`Total pagado,${formatNumber(customerStatement.summary.total_paid)}`);
      lines.push(`Total pendiente,${formatNumber(customerStatement.summary.total_pending)}`);
      lines.push(`Total vencido,${formatNumber(customerStatement.summary.total_overdue)}`);
      lines.push(`Saldo final,${formatNumber(customerStatement.closing_balance)}`);
      lines.push("");

      // Invoices
      lines.push("FACTURAS");
      lines.push("Numero,Fecha,Descripcion,Importe,IVA,Tipo,Estado");
      customerStatement.invoices.forEach(inv => {
        lines.push(`${inv.invoice_number || ""},${inv.invoice_date},${inv.description},${inv.total},${inv.iva_amount},${inv.is_credit_note ? "NC" : "Factura"},${inv.status}`);
      });
      lines.push("");

      // Payments
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

      pushToast({ kind: "success", title: "CSV exportado correctamente" });
    } catch (e) {
      errorToast.show("Error al exportar CSV");
    } finally {
      setExporting(false);
    }
  }, [customerStatement, statementDateFrom, statementDateTo, errorToast, pushToast]);

  // Handle date preset change
  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { dateFrom: df, dateTo: dt } = getQuarterDates(preset, currentYear);
      setDateFrom(df);
      setDateTo(dt);
    }
  }, [currentYear]);

  // Generate report
  const handleGenerateReport = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      errorToast.show("Por favor, selecciona un rango de fechas");
      return;
    }

    setLoading(true);
    try {
      const res = await api.taxReports.getIVAReport({
        date_from: dateFrom,
        date_to: dateTo,
        include_credit_notes: includeCreditNotes,
      });
      if (res.success && res.report) {
        setReport(res.report);
        pushToast({ kind: "success", title: "Reporte generado correctamente" });
      } else {
        const msg = "message" in res ? res.message : undefined;
        errorToast.show(msg || "Error al generar el reporte");
      }
    } catch (e) {
      errorToast.show("Error al conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, includeCreditNotes, api, errorToast, pushToast]);

  // Export to PDF
  const handleExportPDF = useCallback(async () => {
    if (!report) return;

    setExporting(true);
    try {
      const doc = new jsPDF();
      const currency = CURRENCY_SYMBOLS.EUR;

      // Header
      doc.setFontSize(18);
      doc.text("Resumen de IVA", 14, 22);
      doc.setFontSize(10);
      doc.text(`Periodo: ${formatDate(report.date_from)} - ${formatDate(report.date_to)}`, 14, 30);
      doc.text(`Fecha de generacion: ${new Date(report.generated_at).toLocaleString("es-ES")}`, 14, 36);

      // Summary table
      doc.setFontSize(12);
      doc.text("Resumen", 14, 48);

      autoTable(doc, {
        startY: 52,
        head: [["Concepto", "Importe"]],
        body: [
          ["Base imponible", `${currency}${formatNumber(report.summary.total_base)}`],
          ["IVA acumulado", `${currency}${formatNumber(report.summary.total_iva)}`],
          ["Total", `${currency}${formatNumber(report.summary.total)}`],
          ["Facturas", `${report.summary.invoice_count}`],
          ...(includeCreditNotes ? [
            ["Notas de credito", `${report.summary.credit_note_count}`],
            ["Base notas de credito", `${currency}${formatNumber(report.summary.credit_note_base)}`],
            ["IVA notas de credito", `${currency}${formatNumber(report.summary.credit_note_iva)}`],
            ["Base neta", `${currency}${formatNumber(report.summary.net_base)}`],
            ["IVA neto", `${currency}${formatNumber(report.summary.net_iva)}`],
            ["Total neto", `${currency}${formatNumber(report.summary.net_total)}`],
          ] : []),
        ],
        theme: "striped",
      });

      // Breakdown by IVA rate
      const finalY = (doc as any).lastAutoTable?.finalY || 100;
      doc.setFontSize(12);
      doc.text("Desglose por tipo de IVA", 14, finalY + 15);

      autoTable(doc, {
        startY: finalY + 20,
        head: [["Tipo IVA", "Base", "IVA", "Importe", "Facturas"]],
        body: report.breakdown_by_rate.map(b => [
          `${b.iva_rate}%`,
          `${currency}${formatNumber(b.base_amount)}`,
          `${currency}${formatNumber(b.iva_amount)}`,
          `${currency}${formatNumber(b.base_amount + b.iva_amount)}`,
          `${b.invoice_count}`,
        ]),
        theme: "striped",
      });

      // Credit notes section if included
      if (includeCreditNotes && report.breakdown_by_rate.some(b => b.credit_note_count > 0)) {
        const finalY2 = (doc as any).lastAutoTable?.finalY || 150;
        doc.setFontSize(12);
        doc.text("Notas de credito por tipo de IVA", 14, finalY2 + 15);

        autoTable(doc, {
          startY: finalY2 + 20,
          head: [["Tipo IVA", "Notas credito", "Base", "IVA"]],
          body: report.breakdown_by_rate
            .filter(b => b.credit_note_count > 0)
            .map(b => [
              `${b.iva_rate}%`,
              `${b.credit_note_count}`,
              `${currency}${formatNumber(b.credit_note_base)}`,
              `${currency}${formatNumber(b.credit_note_iva)}`,
            ]),
          theme: "striped",
        });
      }

      // Footer
      doc.setFontSize(8);
      doc.text("Generado por Villa Carmen Backoffice", 14, 285);

      doc.save(`iva-report-${report.date_from}-${report.date_to}.pdf`);
      pushToast({ kind: "success", title: "PDF exportado correctamente" });
    } catch (e) {
      errorToast.show("Error al exportar PDF");
    } finally {
      setExporting(false);
    }
  }, [report, includeCreditNotes, errorToast, pushToast]);

  // Export to Excel (CSV format)
  const handleExportExcel = useCallback(() => {
    if (!report) return;

    setExporting(true);
    try {
      // Create CSV content
      const lines: string[] = [];

      // Header
      lines.push("RESUMEN DE IVA");
      lines.push(`Periodo,${report.date_from},${report.date_to}`);
      lines.push(`Fecha generacion,${report.generated_at}`);
      lines.push("");

      // Summary
      lines.push("RESUMEN");
      lines.push(`Base imponible,${formatNumber(report.summary.total_base)}`);
      lines.push(`IVA acumulado,${formatNumber(report.summary.total_iva)}`);
      lines.push(`Total,${formatNumber(report.summary.total)}`);
      lines.push(`Numero de facturas,${report.summary.invoice_count}`);
      if (includeCreditNotes) {
        lines.push("");
        lines.push("NOTAS DE CREDITO");
        lines.push(`Numero de notas de credito,${report.summary.credit_note_count}`);
        lines.push(`Base notas de credito,${formatNumber(report.summary.credit_note_base)}`);
        lines.push(`IVA notas de credito,${formatNumber(report.summary.credit_note_iva)}`);
        lines.push("");
        lines.push("NETO");
        lines.push(`Base neta,${formatNumber(report.summary.net_base)}`);
        lines.push(`IVA neto,${formatNumber(report.summary.net_iva)}`);
        lines.push(`Total neto,${formatNumber(report.summary.net_total)}`);
      }
      lines.push("");

      // Breakdown
      lines.push("DESGLOSE POR TIPO DE IVA");
      lines.push("Tipo IVA,Base,IVA,Importe,Facturas");
      report.breakdown_by_rate.forEach(b => {
        lines.push(`${b.iva_rate}%,${formatNumber(b.base_amount)},${formatNumber(b.iva_amount)},${formatNumber(b.base_amount + b.iva_amount)},${b.invoice_count}`);
      });

      if (includeCreditNotes && report.breakdown_by_rate.some(b => b.credit_note_count > 0)) {
        lines.push("");
        lines.push("NOTAS DE CREDITO POR TIPO");
        lines.push("Tipo IVA,Notas credito,Base,IVA");
        report.breakdown_by_rate
          .filter(b => b.credit_note_count > 0)
          .forEach(b => {
            lines.push(`${b.iva_rate}%,${b.credit_note_count},${formatNumber(b.credit_note_base)},${formatNumber(b.credit_note_iva)}`);
          });
      }

      // Download CSV
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `iva-report-${report.date_from}-${report.date_to}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      pushToast({ kind: "success", title: "Excel (CSV) exportado correctamente" });
    } catch (e) {
      errorToast.show("Error al exportar Excel");
    } finally {
      setExporting(false);
    }
  }, [report, includeCreditNotes, errorToast, pushToast]);

  // Toggle invoice details
  const toggleInvoices = useCallback(() => {
    setExpandedInvoices(prev => !prev);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="text-gray-600">Reportes de IVA y estados de cuenta de clientes</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <SimpleTabs defaultValue="iva">
          <SimpleTabsList className="border-b">
            <SimpleTabsContent value="iva" trigger="Reportes de IVA" />
            <SimpleTabsContent value="customer" trigger="Estado de Cuenta Cliente" />
          </SimpleTabsList>

          {/* Customer Statement Tab */}
          <SimpleTabsContent value="customer">
            <div className="p-6">
              {/* Customer Statement Filters */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Customer Select */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                    <select
                      value={selectedCustomer}
                      onChange={(e) => {
                        setSelectedCustomer(e.target.value);
                        if (e.target.value && customers.length === 0) {
                          loadCustomers();
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Seleccionar cliente...</option>
                      {customers.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} {c.dni_cif ? `(${c.dni_cif})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Statement Date from */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
                    <input
                      type="date"
                      value={statementDateFrom}
                      onChange={(e) => setStatementDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Statement Date to */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
                    <input
                      type="date"
                      value={statementDateTo}
                      onChange={(e) => setStatementDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Load Customers Button */}
                  <div className="flex items-end">
                    <button
                      onClick={loadCustomers}
                      disabled={customersLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
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
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {customerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                    Generar Estado de Cuenta
                  </button>

                  {customerStatement && (
                    <>
                      <button
                        onClick={handleExportCustomerStatementPDF}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        <FileText className="w-4 h-4" />
                        Exportar PDF
                      </button>
                      <button
                        onClick={handleExportCustomerStatementCSV}
                        disabled={exporting}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportar Excel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Statement Content */}
              {customerStatement ? (
                <>
                  {/* Customer Info */}
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Informacion del Cliente</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Nombre</span>
                        <p className="text-lg font-medium text-gray-900">{customerStatement.customer_name}</p>
                      </div>
                      {customerStatement.customer_dni_cif && (
                        <div>
                          <span className="text-sm text-gray-500">DNI/CIF</span>
                          <p className="text-lg font-medium text-gray-900">{customerStatement.customer_dni_cif}</p>
                        </div>
                      )}
                      {customerStatement.customer_email && (
                        <div>
                          <span className="text-sm text-gray-500">Email</span>
                          <p className="text-lg font-medium text-gray-900">{customerStatement.customer_email}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-gray-500">Periodo</span>
                        <p className="text-lg font-medium text-gray-900">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Balance Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    <StatCard
                      title="Saldo Inicial"
                      value={formatCurrency(customerStatement.opening_balance, "EUR")}
                      icon="file-text"
                    />
                    <StatCard
                      title="Total Facturado"
                      value={formatCurrency(customerStatement.summary.total_invoiced, "EUR")}
                      icon="file-text"
                    />
                    <StatCard
                      title="Total Pagado"
                      value={formatCurrency(customerStatement.summary.total_paid, "EUR")}
                      icon="check"
                    />
                    <StatCard
                      title="Pendiente"
                      value={formatCurrency(customerStatement.summary.total_pending, "EUR")}
                      icon="clock"
                    />
                    <StatCard
                      title="Saldo Final"
                      value={formatCurrency(customerStatement.closing_balance, "EUR")}
                      icon="trending-up"
                    />
                  </div>

                  {/* Invoices and Payments Tables */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Invoices */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Facturas ({customerStatement.invoices.length})</h3>
                      </div>
                      {customerStatement.invoices.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {customerStatement.invoices.map((inv, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                    {inv.invoice_number || `#${inv.id}`}
                                    {inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">NC</span>}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(inv.invoice_date)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(inv.total, "EUR")}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-center">
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
                        <div className="p-6 text-center text-gray-500">
                          No hay facturas en este periodo
                        </div>
                      )}
                    </div>

                    {/* Payments */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Pagos ({customerStatement.payments.length})</h3>
                      </div>
                      {customerStatement.payments.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metodo</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {customerStatement.payments.map((pay, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{formatDate(pay.payment_date)}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{pay.payment_method}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(pay.amount, "EUR")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-gray-500">
                          No hay pagos en este periodo
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Sin estado de cuenta</h3>
                  <p className="text-gray-500 mb-4">Selecciona un cliente y un periodo para generar el estado de cuenta</p>
                </div>
              )}
            </div>
          </SimpleTabsContent>

          {/* IVA Report Tab */}
          <SimpleTabsContent value="iva">
            <div>
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Date preset */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DATE_PRESETS.map(preset => (
                <option key={preset.value} value={preset.value}>{preset.label}</option>
              ))}
            </select>
          </div>

          {/* Date from */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDatePreset("custom");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDatePreset("custom");
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Include credit notes */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCreditNotes}
                onChange={(e) => setIncludeCreditNotes(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Incluir notas de credito</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            Generar Reporte
          </button>

          {report && (
            <>
              <button
                onClick={handleExportPDF}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                Exportar PDF
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      {report ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Base Imponible"
              value={formatCurrency(report.summary.total_base, "EUR")}
              icon="file-text"
            />
            <StatCard
              title="IVA Acumulado"
              value={formatCurrency(report.summary.total_iva, "EUR")}
              icon="file-text"
            />
            <StatCard
              title="Total"
              value={formatCurrency(report.summary.total, "EUR")}
              icon="trending-up"
            />
            <StatCard
              title="Facturas"
              value={String(report.summary.invoice_count)}
              icon="users"
            />
          </div>

          {/* Credit Notes Summary (if included) */}
          {includeCreditNotes && report.summary.credit_note_count > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-yellow-800 mb-3">Notas de Credito</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="text-sm text-yellow-700">Cantidad</span>
                  <p className="text-xl font-bold text-yellow-900">{report.summary.credit_note_count}</p>
                </div>
                <div>
                  <span className="text-sm text-yellow-700">Base</span>
                  <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_base, "EUR")}</p>
                </div>
                <div>
                  <span className="text-sm text-yellow-700">IVA</span>
                  <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_iva, "EUR")}</p>
                </div>
                <div>
                  <span className="text-sm text-yellow-700">Total</span>
                  <p className="text-xl font-bold text-yellow-900">{formatCurrency(report.summary.credit_note_base + report.summary.credit_note_iva, "EUR")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Net Total (after credit notes) */}
          {includeCreditNotes && report.summary.credit_note_count > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="text-lg font-semibold text-green-800 mb-3">Total Neto (despues de notas de credito)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="text-sm text-green-700">Base neta</span>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_base, "EUR")}</p>
                </div>
                <div>
                  <span className="text-sm text-green-700">IVA neto</span>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_iva, "EUR")}</p>
                </div>
                <div>
                  <span className="text-sm text-green-700">Total neto</span>
                  <p className="text-2xl font-bold text-green-900">{formatCurrency(report.summary.net_total, "EUR")}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tabs for Breakdown and Quarterly */}
          <SimpleTabs defaultValue="breakdown">
            <SimpleTabsList>
              <SimpleTabsContent value="breakdown" trigger="Desglose por IVA" />
              <SimpleTabsContent value="quarterly" trigger="Trimestral" />
              <SimpleTabsContent value="invoices" trigger="Facturas" />
            </SimpleTabsList>

            {/* Breakdown by IVA Rate */}
            <SimpleTabsContent value="breakdown">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo IVA</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Facturas</th>
                      {includeCreditNotes && (
                        <>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Notas Cred.</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base NC</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IVA NC</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.breakdown_by_rate.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.iva_rate}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(item.base_amount, "EUR")}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">{formatCurrency(item.base_amount + item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.invoice_count}</td>
                        {includeCreditNotes && (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.credit_note_count}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">{formatCurrency(item.credit_note_base, "EUR")}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">{formatCurrency(item.credit_note_iva, "EUR")}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">TOTAL</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(report.summary.total_base, "EUR")}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(report.summary.total_iva, "EUR")}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(report.summary.total, "EUR")}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">{report.summary.invoice_count}</td>
                      {includeCreditNotes && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-gray-900">{report.summary.credit_note_count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(report.summary.credit_note_base, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-bold text-gray-900">{formatCurrency(report.summary.credit_note_iva, "EUR")}</td>
                        </>
                      )}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SimpleTabsContent>

            {/* Quarterly Breakdown */}
            <SimpleTabsContent value="quarterly">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trimestre</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periodo</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Facturas</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Notas Cred.</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.quarterlyBreakdown.length > 0 ? (
                      data.quarterlyBreakdown.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.quarterLabel}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(item.start_date)} - {formatDate(item.end_date)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(item.base_amount, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(item.iva_amount, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">{formatCurrency(item.total, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.invoice_count}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{item.credit_note_count}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          No hay datos trimestrales disponibles. Genera un reporte para ver el desglose.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SimpleTabsContent>

            {/* Invoice List */}
            <SimpleTabsContent value="invoices">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={toggleInvoices}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">Lista de facturas ({report.invoices.length})</span>
                  {expandedInvoices ? <ChevronUp className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                </button>
                {expandedInvoices && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Factura</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Base</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">IVA</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">IVA Importe</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {report.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{inv.invoice_number || ` #${inv.id}`}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{inv.customer_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(inv.invoice_date)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(inv.base_amount, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">{inv.iva_rate}%</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(inv.iva_amount, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">{formatCurrency(inv.total, "EUR")}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                            {inv.is_credit_note ? (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">NC</span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Factura</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </SimpleTabsContent>
          </SimpleTabs>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay reporte generado</h3>
          <p className="text-gray-500 mb-4">Selecciona un periodo y genera el reporte para ver el resumen de IVA</p>
          <button
            onClick={handleGenerateReport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            Generar Reporte
          </button>
        </div>
      )}
            </div>
          </SimpleTabsContent>
        </SimpleTabs>
      </div>
    </div>
  );
}
