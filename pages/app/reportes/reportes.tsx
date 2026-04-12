import React, { useCallback, useMemo, useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { TaxReport, TaxReportQuarterlyBreakdown, CustomerStatement } from "../../../api/types";
import { formatCurrency } from "../../../api/types";
import { SimpleTabs, SimpleTabsContent, SimpleTabsList } from "../../../ui/nav/SimpleTabs";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { FileText, Filter, FileSpreadsheet, RefreshCw, ChevronDown, ChevronUp, User, Receipt } from "lucide-react";
import { exportCustomerStatementPDF, exportCustomerStatementCSV, exportIVAPDF, exportIVACSV } from "./helpers/reportExportHelpers";

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
  { value: "this_year", label: "Este año" },
  { value: "last_year", label: "Año anterior" },
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

// ─── Customer Statement Section ────────────────────────────────────────────────

function CustomerStatementSection({
  api,
  customers: initialCustomers,
  currentYear,
}: {
  api: ReturnType<typeof createClient>;
  customers: { name: string; email?: string; dni_cif?: string }[];
  currentYear: number;
}) {
  const { pushToast } = useToasts();
  const errorToast = useErrorToast();

  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [customerStatement, setCustomerStatement] = useState<CustomerStatement | null>(null);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [statementDateFrom, setStatementDateFrom] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split("T")[0];
  });
  const [statementDateTo, setStatementDateTo] = useState(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.toISOString().split("T")[0];
  });
  const [customersLoading, setCustomersLoading] = useState(false);

  const loadCustomers = useCallback(async () => {
    setCustomersLoading(true);
    try {
      const res = await api.taxReports.listCustomersWithInvoices();
      if (res.success && res.customers) setCustomers(res.customers);
    } finally {
      setCustomersLoading(false);
    }
  }, [api]);

  const handleGenerate = useCallback(async () => {
    if (!selectedCustomer) { errorToast.show("Por favor, selecciona un cliente"); return; }
    if (!statementDateFrom || !statementDateTo) { errorToast.show("Por favor, selecciona un rango de fechas"); return; }

    setCustomerLoading(true);
    try {
      const res = await api.taxReports.getCustomerStatement({
        customer_name: selectedCustomer,
        date_from: statementDateFrom,
        date_to: statementDateTo,
      });
      if (res.success && res.statement) {
        setCustomerStatement(res.statement);
        pushToast({ kind: "success", title: "Éxito", message: "Estado de cuenta generado correctamente" });
      } else {
        errorToast.show("No se pudo generar el estado de cuenta");
      }
    } catch { errorToast.show("Error al conectar con el servidor"); }
    finally { setCustomerLoading(false); }
  }, [selectedCustomer, statementDateFrom, statementDateTo, api, errorToast, pushToast]);

  const handleExportPDF = useCallback(async () => {
    if (!customerStatement) return;
    setExporting(true);
    try {
      exportCustomerStatementPDF(customerStatement, statementDateFrom, statementDateTo, pushToast, errorToast);
    } catch { errorToast.show("Error al exportar PDF"); }
    finally { setExporting(false); }
  }, [customerStatement, statementDateFrom, statementDateTo, pushToast, errorToast]);

  const handleExportCSV = useCallback(() => {
    if (!customerStatement) return;
    setExporting(true);
    try {
      exportCustomerStatementCSV(customerStatement, statementDateFrom, statementDateTo, pushToast, errorToast);
    } catch { errorToast.show("Error al exportar CSV"); }
    finally { setExporting(false); }
  }, [customerStatement, statementDateFrom, statementDateTo, pushToast, errorToast]);

  return (
    <div data-testid="reportes-customer-statement-section">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              value={selectedCustomer}
              onChange={(e) => { setSelectedCustomer(e.target.value); if (e.target.value && customers.length === 0) loadCustomers(); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-customer-select"
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>{c.name} {c.dni_cif ? `(${c.dni_cif})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input type="date" value={statementDateFrom} onChange={(e) => setStatementDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-customer-date-from" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input type="date" value={statementDateTo} onChange={(e) => setStatementDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-customer-date-to" />
          </div>
          <div className="flex items-end">
            <button onClick={loadCustomers} disabled={customersLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
              data-testid="reportes-load-customers-button">
              {customersLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              Cargar Clientes
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleGenerate} disabled={customerLoading || !selectedCustomer}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            data-testid="reportes-generate-statement-button">
            {customerLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
            Generar Estado de Cuenta
          </button>
          {customerStatement && (
            <>
              <button onClick={handleExportPDF} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                data-testid="reportes-export-pdf-button">
                <FileText className="w-4 h-4" /> Exportar PDF
              </button>
              <button onClick={handleExportCSV} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                data-testid="reportes-export-csv-button">
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {customerStatement ? (
        <>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4" data-slot="reportes-info-cliente">Información del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><span className="text-sm text-gray-500">Nombre</span><p className="text-lg font-medium">{customerStatement.customer_name}</p></div>
              {customerStatement.customer_dni_cif && <div><span className="text-sm text-gray-500">DNI/CIF</span><p className="text-lg font-medium">{customerStatement.customer_dni_cif}</p></div>}
              {customerStatement.customer_email && <div><span className="text-sm text-gray-500">Email</span><p className="text-lg font-medium">{customerStatement.customer_email}</p></div>}
              <div><span className="text-sm text-gray-500">Periodo</span><p className="text-lg font-medium">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <StatCard title="Saldo Inicial" value={formatCurrency(customerStatement.opening_balance, "EUR")} icon="calendar" />
            <StatCard title="Total Facturado" value={formatCurrency(customerStatement.summary.total_invoiced, "EUR")} icon="file-text" />
            <StatCard title="Total Pagado" value={formatCurrency(customerStatement.summary.total_paid, "EUR")} icon="check" />
            <StatCard title="Pendiente" value={formatCurrency(customerStatement.summary.total_pending, "EUR")} icon="clock" />
            <StatCard title="Saldo Final" value={formatCurrency(customerStatement.closing_balance, "EUR")} icon="trending-up" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold" data-slot="reportes-facturas-list">Facturas ({customerStatement.invoices.length})</h3>
              </div>
              {customerStatement.invoices.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerStatement.invoices.map((inv, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3 text-sm text-gray-900">{inv.invoice_number || `#${inv.id}`}{inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">NC</span>}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(inv.total, "EUR")}</td>
                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 text-xs rounded-full ${inv.status === "pagada" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-6 text-center text-gray-500">No hay facturas</div>}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-lg font-semibold" data-slot="reportes-pagos-list">Pagos ({customerStatement.payments.length})</h3>
              </div>
              {customerStatement.payments.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Método</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Importe</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {customerStatement.payments.map((pay, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3 text-sm">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(pay.payment_date)}</td>
                        <td className="px-4 py-3 text-sm">{pay.payment_method}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(pay.amount, "EUR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-6 text-center text-gray-500">No hay pagos</div>}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2" data-slot="reportes-sin-estado-cuenta">Sin estado de cuenta</h3>
          <p className="text-gray-500">Selecciona un cliente y un periodo para generar</p>
        </div>
      )}
    </div>
  );
}

// ─── IVA Report Section ───────────────────────────────────────────────────────

function IVAReportSection({
  initialReport,
  quarterlyBreakdown,
  currentYear,
  api,
}: {
  initialReport: TaxReport | null;
  quarterlyBreakdown: TaxReportQuarterlyBreakdown[];
  currentYear: number;
  api: ReturnType<typeof createClient>;
}) {
  const { pushToast } = useToasts();
  const errorToast = useErrorToast();

  const [report, setReport] = useState<TaxReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [datePreset, setDatePreset] = useState<DatePreset>("this_quarter");
  const [dateFrom, setDateFrom] = useState(() => {
    if (initialReport) return initialReport.date_from;
    const { dateFrom: df, dateTo: dt } = getQuarterDates("this_quarter", currentYear);
    return df;
  });
  const [dateTo, setDateTo] = useState(() => {
    if (initialReport) return initialReport.date_to;
    const { dateFrom: df, dateTo: dt } = getQuarterDates("this_quarter", currentYear);
    return dt;
  });
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);
  const [expandedInvoices, setExpandedInvoices] = useState(false);

  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    if (preset !== "custom") {
      const { dateFrom: df, dateTo: dt } = getQuarterDates(preset, currentYear);
      setDateFrom(df);
      setDateTo(dt);
    }
  }, [currentYear]);

  const handleGenerate = useCallback(async () => {
    if (!dateFrom || !dateTo) { errorToast.show("Por favor, selecciona un rango de fechas"); return; }
    setLoading(true);
    try {
      const res = await api.taxReports.getIVAReport({ date_from: dateFrom, date_to: dateTo, include_credit_notes: includeCreditNotes });
      if (res.success && res.report) {
        setReport(res.report);
        pushToast({ kind: "success", title: "Éxito", message: "Reporte generado correctamente" });
      } else { errorToast.show("Error al generar el reporte"); }
    } catch { errorToast.show("Error al conectar con el servidor"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, includeCreditNotes, api, errorToast, pushToast]);

  const handleExportPDF = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    try { exportIVAPDF(report, includeCreditNotes, pushToast, errorToast); }
    catch { errorToast.show("Error al exportar PDF"); }
    finally { setExporting(false); }
  }, [report, includeCreditNotes, pushToast, errorToast]);

  const handleExportCSV = useCallback(() => {
    if (!report) return;
    setExporting(true);
    try { exportIVACSV(report, includeCreditNotes, pushToast, errorToast); }
    catch { errorToast.show("Error al exportar Excel"); }
    finally { setExporting(false); }
  }, [report, includeCreditNotes, pushToast, errorToast]);

  return (
    <div data-testid="reportes-iva-section">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Periodo</label>
            <select value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-iva-period-select">
              {DATE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-iva-date-from" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="reportes-iva-date-to" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer" data-testid="reportes-include-credit-notes-label">
              <input type="checkbox" checked={includeCreditNotes} onChange={(e) => setIncludeCreditNotes(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                data-testid="reportes-include-credit-notes-checkbox" />
              <span className="text-sm text-gray-700">Incluir notas de crédito</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            data-testid="reportes-generate-iva-button">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Generar Reporte
          </button>
          {report && (
            <>
              <button onClick={handleExportPDF} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                data-testid="reportes-iva-export-pdf-button">
                <FileText className="w-4 h-4" /> Exportar PDF
              </button>
              <button onClick={handleExportCSV} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                data-testid="reportes-iva-export-csv-button">
                <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
              </button>
            </>
          )}
        </div>
      </div>

      {report ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <StatCard title="Base Imponible" value={formatCurrency(report.summary.total_base, "EUR")} icon="file-text" />
            <StatCard title="IVA Acumulado" value={formatCurrency(report.summary.total_iva, "EUR")} icon="calendar" />
            <StatCard title="Total" value={formatCurrency(report.summary.total, "EUR")} icon="trending-up" />
            <StatCard title="Facturas" value={String(report.summary.invoice_count)} icon="users" />
          </div>

          {includeCreditNotes && report.summary.credit_note_count > 0 && (
            <>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-yellow-800 mb-3" data-slot="reportes-notas-credito">Notas de Crédito</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><span className="text-sm text-yellow-700">Cantidad</span><p className="text-xl font-bold">{report.summary.credit_note_count}</p></div>
                  <div><span className="text-sm text-yellow-700">Base</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_base, "EUR")}</p></div>
                  <div><span className="text-sm text-yellow-700">IVA</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_iva, "EUR")}</p></div>
                  <div><span className="text-sm text-yellow-700">Total</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_base + report.summary.credit_note_iva, "EUR")}</p></div>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-green-800 mb-3" data-slot="reportes-total-neto">Total Neto (después de NC)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><span className="text-sm text-green-700">Base neta</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_base, "EUR")}</p></div>
                  <div><span className="text-sm text-green-700">IVA neto</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_iva, "EUR")}</p></div>
                  <div><span className="text-sm text-green-700">Total neto</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_total, "EUR")}</p></div>
                </div>
              </div>
            </>
          )}

          <SimpleTabs defaultValue="breakdown">
            <SimpleTabsList>
              <SimpleTabsContent value="breakdown" trigger="Desglose por IVA" />
              <SimpleTabsContent value="quarterly" trigger="Trimestral" />
              <SimpleTabsContent value="invoices" trigger="Facturas" />
            </SimpleTabsList>

            <SimpleTabsContent value="breakdown">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Facturas</th>
                    {includeCreditNotes && <><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Notas Créd.</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base NC</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IVA NC</th></>}
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {report.breakdown_by_rate.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-6 py-4 font-medium">{item.iva_rate}%</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(item.base_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right font-semibold">{formatCurrency(item.base_amount + item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-center">{item.invoice_count}</td>
                        {includeCreditNotes && <><td className="px-6 py-4 text-center">{item.credit_note_count}</td><td className="px-6 py-4 text-right">{formatCurrency(item.credit_note_base, "EUR")}</td><td className="px-6 py-4 text-right">{formatCurrency(item.credit_note_iva, "EUR")}</td></>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-100"><tr>
                    <td className="px-6 py-4 font-bold">TOTAL</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.total_base, "EUR")}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.total_iva, "EUR")}</td>
                    <td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.total, "EUR")}</td>
                    <td className="px-6 py-4 text-center font-bold">{report.summary.invoice_count}</td>
                    {includeCreditNotes && <><td className="px-6 py-4 text-center font-bold">{report.summary.credit_note_count}</td><td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.credit_note_base, "EUR")}</td><td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.credit_note_iva, "EUR")}</td></>}
                  </tr></tfoot>
                </table>
              </div>
            </SimpleTabsContent>

            <SimpleTabsContent value="quarterly">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trimestre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Periodo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Facturas</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Notas Créd.</th>
                  </tr></thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {quarterlyBreakdown.length > 0 ? quarterlyBreakdown.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-6 py-4 font-medium">{item.quarterLabel}</td>
                        <td className="px-6 py-4">{formatDate(item.start_date)} - {formatDate(item.end_date)}</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(item.base_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right">{formatCurrency(item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right font-semibold">{formatCurrency(item.total, "EUR")}</td>
                        <td className="px-6 py-4 text-center">{item.invoice_count}</td>
                        <td className="px-6 py-4 text-center">{item.credit_note_count}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={7} className="px-6 py-8 text-center text-gray-500">No hay datos trimestrales disponibles.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SimpleTabsContent>

            <SimpleTabsContent value="invoices">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <button onClick={() => setExpandedInvoices(!expandedInvoices)} className="w-full px-6 py-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
                  data-testid="reportes-toggle-invoices-button">
                  <span className="text-sm font-medium">Lista de facturas ({report.invoices.length})</span>
                  {expandedInvoices ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedInvoices && (
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50"><tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Factura</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Base</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">IVA</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">IVA Importe</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    </tr></thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {report.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                          <td className="px-6 py-4">{inv.invoice_number || `#${inv.id}`}</td>
                          <td className="px-6 py-4">{inv.customer_name}</td>
                          <td className="px-6 py-4">{formatDate(inv.invoice_date)}</td>
                          <td className="px-6 py-4 text-right">{formatCurrency(inv.base_amount, "EUR")}</td>
                          <td className="px-6 py-4 text-center">{inv.iva_rate}%</td>
                          <td className="px-6 py-4 text-right">{formatCurrency(inv.iva_amount, "EUR")}</td>
                          <td className="px-6 py-4 text-right font-semibold">{formatCurrency(inv.total, "EUR")}</td>
                          <td className="px-6 py-4 text-center">
                            {inv.is_credit_note ? <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">NC</span> : <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Factura</span>}
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
          <h3 className="text-lg font-medium text-gray-900 mb-2" data-slot="reportes-sin-reporte-generado">No hay reporte generado</h3>
          <p className="text-gray-500 mb-4">Selecciona un periodo y genera el reporte</p>
          <button onClick={handleGenerate} disabled={loading} data-testid="reportes-generate-btn"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Generar Reporte
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const currentYear = data.currentYear || new Date().getFullYear();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-slot="reportes-page-title">Reportes</h1>
          <p className="text-gray-600">Reportes de IVA y estados de cuenta de clientes</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <SimpleTabs defaultValue="iva">
          <SimpleTabsList className="border-b">
            <SimpleTabsContent value="iva" trigger="Reportes de IVA" />
            <SimpleTabsContent value="customer" trigger="Estado de Cuenta Cliente" />
          </SimpleTabsList>

          <SimpleTabsContent value="customer">
            <CustomerStatementSection api={api} customers={data.customers || []} currentYear={currentYear} />
          </SimpleTabsContent>

          <SimpleTabsContent value="iva">
            <IVAReportSection initialReport={data.report} quarterlyBreakdown={data.quarterlyBreakdown} currentYear={currentYear} api={api} />
          </SimpleTabsContent>
        </SimpleTabs>
      </div>
    </div>
  );
}
