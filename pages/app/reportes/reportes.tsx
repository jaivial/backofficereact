import React, { useCallback, useMemo, useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { createClient } from "../../../api/client";
import type { TaxReport, TaxReportQuarterlyBreakdown, CustomerStatement } from "../../../api/types";
import { formatCurrency } from "../../../api/types";
import { Tabs } from "../../../ui/nav/Tabs";
import { StatCard } from "../../../ui/widgets/StatCard";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { Card } from "../../../ui/shell/Card";
import { EmptyState } from "../../../ui/feedback/EmptyState";
import { ExportButtonPair } from "../../../ui/actions/ExportButtonPair";
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
      <Card variant="tailwind" padding className="mb-6" data-slot="reportes-mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-slot="reportes-gap-4">
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Cliente</label>
            <select
              value={selectedCustomer}
              onChange={(e) => { setSelectedCustomer(e.target.value); if (e.target.value && customers.length === 0) loadCustomers(); }}
              className="bo-input w-full"
              data-testid="reportes-customer-select"
            >
              <option value="">Seleccionar cliente...</option>
              {customers.map((c) => (
                <option key={c.name} value={c.name}>{c.name} {c.dni_cif ? `(${c.dni_cif})` : ""}</option>
              ))}
            </select>
          </div>
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Desde</label>
            <input type="date" value={statementDateFrom} onChange={(e) => setStatementDateFrom(e.target.value)}
              className="bo-input w-full"
              data-testid="reportes-customer-date-from" />
          </div>
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Hasta</label>
            <input type="date" value={statementDateTo} onChange={(e) => setStatementDateTo(e.target.value)}
              className="bo-input w-full"
              data-testid="reportes-customer-date-to" />
          </div>
          <div className="flex items-end" data-slot="reportes-items-end">
            <button onClick={loadCustomers} disabled={customersLoading}
              className="bo-btn bo-btn--secondary flex items-center gap-2 disabled:opacity-50"
              data-testid="reportes-load-customers-button">
              {customersLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
              Cargar Clientes
            </button>
          </div>
        </div>
        <div className="flex gap-2 mt-4" data-slot="reportes-mt-4">
          <button onClick={handleGenerate} disabled={customerLoading || !selectedCustomer}
            className="bo-btn bo-btn--primary flex items-center gap-2 disabled:opacity-50"
            data-testid="reportes-generate-statement-button">
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

      {customerStatement ? (
        <>
          <Card variant="tailwind" padding className="mb-6" data-slot="reportes-mb-6">
            <h3 className="text-lg font-semibold text-[var(--bo-text)] mb-4" data-slot="reportes-info-cliente">Información del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-slot="reportes-gap-4">
              <div data-slot="reportes-text-[var(--bo-muted)]"><span className="text-sm text-[var(--bo-muted)]">Nombre</span><p className="text-lg font-medium">{customerStatement.customer_name}</p></div>
              {customerStatement.customer_dni_cif && <div><span className="text-sm text-[var(--bo-muted)]">DNI/CIF</span><p className="text-lg font-medium">{customerStatement.customer_dni_cif}</p></div>}
              {customerStatement.customer_email && <div><span className="text-sm text-[var(--bo-muted)]">Email</span><p className="text-lg font-medium">{customerStatement.customer_email}</p></div>}
              <div data-slot="reportes-text-[var(--bo-muted)]"><span className="text-sm text-[var(--bo-muted)]">Periodo</span><p className="text-lg font-medium">{formatDate(customerStatement.date_from)} - {formatDate(customerStatement.date_to)}</p></div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6" data-slot="reportes-mb-6">
            <StatCard title="Saldo Inicial" value={formatCurrency(customerStatement.opening_balance, "EUR")} icon="calendar" />
            <StatCard title="Total Facturado" value={formatCurrency(customerStatement.summary.total_invoiced, "EUR")} icon="file-text" />
            <StatCard title="Total Pagado" value={formatCurrency(customerStatement.summary.total_paid, "EUR")} icon="check" />
            <StatCard title="Pendiente" value={formatCurrency(customerStatement.summary.total_pending, "EUR")} icon="clock" />
            <StatCard title="Saldo Final" value={formatCurrency(customerStatement.closing_balance, "EUR")} icon="trending-up" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-slot="reportes-gap-6">
            <Card variant="tailwind" className="overflow-hidden" data-slot="reportes-overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]">
                <h3 className="text-lg font-semibold" data-slot="reportes-facturas-list">Facturas ({customerStatement.invoices.length})</h3>
              </div>
              {customerStatement.invoices.length > 0 ? (
                <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                  <thead className="bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Importe</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Estado</th>
                  </tr></thead>
                  <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                    {customerStatement.invoices.map((inv, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="reportes-tr">
                        <td className="px-4 py-3 text-sm text-[var(--bo-text)]" data-slot="reportes-text-[var(--bo-text)]">{inv.invoice_number || `#${inv.id}`}{inv.is_credit_note && <span className="ml-2 px-2 py-1 text-xs rounded-full bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]">NC</span>}</td>
                        <td className="px-4 py-3 text-sm text-[var(--bo-muted)]" data-slot="reportes-text-[var(--bo-muted)]">{formatDate(inv.invoice_date)}</td>
                        <td className="px-4 py-3 text-sm text-right" data-slot="reportes-text-right">{formatCurrency(inv.total, "EUR")}</td>
                        <td className="px-4 py-3 text-center" data-slot="reportes-text-center"><span className={`px-2 py-1 text-xs rounded-full ${inv.status === "pagada" ? "bg-green-100 text-[var(--bo-color-success)]" : "bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]"}`}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-6 text-center text-[var(--bo-muted)]">No hay facturas</div>}
            </Card>

            <Card variant="tailwind" className="overflow-hidden" data-slot="reportes-overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--bo-border)] bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]">
                <h3 className="text-lg font-semibold" data-slot="reportes-pagos-list">Pagos ({customerStatement.payments.length})</h3>
              </div>
              {customerStatement.payments.length > 0 ? (
                <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                  <thead className="bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]"><tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Factura</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Método</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Importe</th>
                  </tr></thead>
                  <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                    {customerStatement.payments.map((pay, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="reportes-tr">
                        <td className="px-4 py-3 text-sm" data-slot="reportes-text-sm">{pay.invoice_number || `#${pay.invoice_id}`}</td>
                        <td className="px-4 py-3 text-sm" data-slot="reportes-text-sm">{formatDate(pay.payment_date)}</td>
                        <td className="px-4 py-3 text-sm" data-slot="reportes-text-sm">{pay.payment_method}</td>
                        <td className="px-4 py-3 text-sm text-right" data-slot="reportes-text-right">{formatCurrency(pay.amount, "EUR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="p-6 text-center text-[var(--bo-muted)]">No hay pagos</div>}
            </Card>
          </div>
        </>
      ) : (
        <EmptyState variant="tailwind" data-slot="reportes-text-center"
          icon={<Receipt className="w-12 h-12 text-[var(--bo-faint)] mx-auto mb-4" />}
          title="Sin estado de cuenta"
          description="Selecciona un cliente y un periodo para generar"
        />
      )}
    </div>
  );
}

// ─── IVA Report Section ───────────────────────────────────────────────────────

type IvaTab = "breakdown" | "quarterly" | "invoices";

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

  const [ivaTab, setIvaTab] = useState<IvaTab>("breakdown");
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
      <Card variant="tailwind" padding className="mb-6" data-slot="reportes-mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-slot="reportes-gap-4">
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Periodo</label>
            <select value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
              className="bo-input w-full"
              data-testid="reportes-iva-period-select">
              {DATE_PRESETS.map(preset => <option key={preset.value} value={preset.value}>{preset.label}</option>)}
            </select>
          </div>
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Desde</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setDatePreset("custom"); }}
              className="bo-input w-full"
              data-testid="reportes-iva-date-from" />
          </div>
          <div data-slot="reportes-div">
            <label className="block text-sm font-medium text-[var(--bo-text)] mb-1" data-slot="reportes-mb-1">Hasta</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setDatePreset("custom"); }}
              className="bo-input w-full"
              data-testid="reportes-iva-date-to" />
          </div>
          <div className="flex items-end" data-slot="reportes-items-end">
            <label className="flex items-center gap-2 cursor-pointer" data-testid="reportes-include-credit-notes-label">
              <input type="checkbox" checked={includeCreditNotes} onChange={(e) => setIncludeCreditNotes(e.target.checked)}
                className="w-4 h-4 text-[var(--bo-accent)] border-[var(--bo-border-2)] rounded focus:ring-[var(--bo-accent)]"
                data-testid="reportes-include-credit-notes-checkbox" />
              <span className="text-sm text-[var(--bo-text)]" data-slot="reportes-text-[var(--bo-text)]">Incluir notas de crédito</span>
            </label>
          </div>
        </div>
        <div className="flex gap-2 mt-4" data-slot="reportes-mt-4">
          <button onClick={handleGenerate} disabled={loading}
            className="bo-btn bo-btn--primary flex items-center gap-2 disabled:opacity-50"
            data-testid="reportes-generate-iva-button">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Generar Reporte
          </button>
          {report && (
            <ExportButtonPair
              onExportPdf={handleExportPDF}
              onExportExcel={handleExportCSV}
              pdfLabel="Exportar PDF"
              excelLabel="Exportar Excel"
            />
          )}
        </div>
      </Card>

      {report ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" data-slot="reportes-mb-6">
            <StatCard title="Base Imponible" value={formatCurrency(report.summary.total_base, "EUR")} icon="file-text" />
            <StatCard title="IVA Acumulado" value={formatCurrency(report.summary.total_iva, "EUR")} icon="calendar" />
            <StatCard title="Total" value={formatCurrency(report.summary.total, "EUR")} icon="trending-up" />
            <StatCard title="Facturas" value={String(report.summary.invoice_count)} icon="users" />
          </div>

          {includeCreditNotes && report.summary.credit_note_count > 0 && (
            <>
              <div className="bg-[var(--bo-warning-bg)] border border-[var(--bo-color-warning)] rounded-lg p-4 mb-6" data-slot="reportes-mb-6">
                <h3 className="text-lg font-semibold text-[var(--bo-color-warning)] mb-3" data-slot="reportes-notas-credito">Notas de Crédito</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-slot="reportes-gap-4">
                  <div data-slot="reportes-text-[var(--bo-color-warning)]"><span className="text-sm text-[var(--bo-color-warning)]">Cantidad</span><p className="text-xl font-bold">{report.summary.credit_note_count}</p></div>
                  <div data-slot="reportes-text-[var(--bo-color-warning)]"><span className="text-sm text-[var(--bo-color-warning)]">Base</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_base, "EUR")}</p></div>
                  <div data-slot="reportes-text-[var(--bo-color-warning)]"><span className="text-sm text-[var(--bo-color-warning)]">IVA</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_iva, "EUR")}</p></div>
                  <div data-slot="reportes-text-[var(--bo-color-warning)]"><span className="text-sm text-[var(--bo-color-warning)]">Total</span><p className="text-xl font-bold">{formatCurrency(report.summary.credit_note_base + report.summary.credit_note_iva, "EUR")}</p></div>
                </div>
              </div>
              <div className="bg-[var(--bo-success-bg)] border border-[var(--bo-color-success)] rounded-lg p-4 mb-6" data-slot="reportes-mb-6">
                <h3 className="text-lg font-semibold text-[var(--bo-color-success)] mb-3" data-slot="reportes-total-neto">Total Neto (después de NC)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-slot="reportes-gap-4">
                  <div data-slot="reportes-text-[var(--bo-color-success)]"><span className="text-sm text-[var(--bo-color-success)]">Base neta</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_base, "EUR")}</p></div>
                  <div data-slot="reportes-text-[var(--bo-color-success)]"><span className="text-sm text-[var(--bo-color-success)]">IVA neto</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_iva, "EUR")}</p></div>
                  <div data-slot="reportes-text-[var(--bo-color-success)]"><span className="text-sm text-[var(--bo-color-success)]">Total neto</span><p className="text-2xl font-bold">{formatCurrency(report.summary.net_total, "EUR")}</p></div>
                </div>
              </div>
            </>
          )}

          <div className="bo-menuEditorTabs" data-testid="reportes-iva-tabs">
            <Tabs
              tabs={[
                { id: "breakdown", label: "Desglose por IVA", href: "#" },
                { id: "quarterly", label: "Trimestral", href: "#" },
                { id: "invoices", label: "Facturas", href: "#" },
              ]}
              activeId={ivaTab}
              ariaLabel="Vistas del reporte de IVA"
              mode="button"
              onNavigate={(_href, id) => setIvaTab(id as IvaTab)}
            />
          </div>

            {ivaTab === "breakdown" && (
              <Card variant="tailwind" className="overflow-hidden" data-slot="reportes-overflow-hidden">
                <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                  <thead className="bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Tipo IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Base</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Facturas</th>
                    {includeCreditNotes && <><th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase">Notas Créd.</th><th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase">Base NC</th><th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase">IVA NC</th></>}
                  </tr></thead>
                  <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                    {report.breakdown_by_rate.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="reportes-tr">
                        <td className="px-6 py-4 font-medium" data-slot="reportes-font-medium">{item.iva_rate}%</td>
                        <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(item.base_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right font-semibold" data-slot="reportes-font-semibold">{formatCurrency(item.base_amount + item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-center" data-slot="reportes-text-center">{item.invoice_count}</td>
                        {includeCreditNotes && <><td className="px-6 py-4 text-center">{item.credit_note_count}</td><td className="px-6 py-4 text-right">{formatCurrency(item.credit_note_base, "EUR")}</td><td className="px-6 py-4 text-right">{formatCurrency(item.credit_note_iva, "EUR")}</td></>}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[var(--bo-surface-3)]"><tr>
                    <td className="px-6 py-4 font-bold" data-slot="reportes-font-bold">TOTAL</td>
                    <td className="px-6 py-4 text-right font-bold" data-slot="reportes-font-bold">{formatCurrency(report.summary.total_base, "EUR")}</td>
                    <td className="px-6 py-4 text-right font-bold" data-slot="reportes-font-bold">{formatCurrency(report.summary.total_iva, "EUR")}</td>
                    <td className="px-6 py-4 text-right font-bold" data-slot="reportes-font-bold">{formatCurrency(report.summary.total, "EUR")}</td>
                    <td className="px-6 py-4 text-center font-bold" data-slot="reportes-font-bold">{report.summary.invoice_count}</td>
                    {includeCreditNotes && <><td className="px-6 py-4 text-center font-bold">{report.summary.credit_note_count}</td><td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.credit_note_base, "EUR")}</td><td className="px-6 py-4 text-right font-bold">{formatCurrency(report.summary.credit_note_iva, "EUR")}</td></>}
                  </tr></tfoot>
                </table>
              </Card>
            )}

            {ivaTab === "quarterly" && (
              <Card variant="tailwind" className="overflow-hidden" data-slot="reportes-overflow-hidden">
                <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                  <thead className="bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]"><tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Trimestre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Periodo</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Base</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">IVA</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Facturas</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Notas Créd.</th>
                  </tr></thead>
                  <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                    {quarterlyBreakdown.length > 0 ? quarterlyBreakdown.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="reportes-tr">
                        <td className="px-6 py-4 font-medium" data-slot="reportes-font-medium">{item.quarterLabel}</td>
                        <td className="px-6 py-4" data-slot="reportes-py-4">{formatDate(item.start_date)} - {formatDate(item.end_date)}</td>
                        <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(item.base_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(item.iva_amount, "EUR")}</td>
                        <td className="px-6 py-4 text-right font-semibold" data-slot="reportes-font-semibold">{formatCurrency(item.total, "EUR")}</td>
                        <td className="px-6 py-4 text-center" data-slot="reportes-text-center">{item.invoice_count}</td>
                        <td className="px-6 py-4 text-center" data-slot="reportes-text-center">{item.credit_note_count}</td>
                      </tr>
                    )) : (
                      <tr data-slot="reportes-text-[var(--bo-muted)]"><td colSpan={7} className="px-6 py-8 text-center text-[var(--bo-muted)]">No hay datos trimestrales disponibles.</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            )}

            {ivaTab === "invoices" && (
              <Card variant="tailwind" className="overflow-hidden" data-slot="reportes-overflow-hidden">
                <button onClick={() => setExpandedInvoices(!expandedInvoices)} className="w-full px-6 py-4 flex items-center justify-between bg-[var(--bo-surface-2)] hover:bg-[var(--bo-surface-3)]"
                  data-testid="reportes-toggle-invoices-button">
                  <span className="text-sm font-medium" data-slot="reportes-font-medium">Lista de facturas ({report.invoices.length})</span>
                  {expandedInvoices ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedInvoices && (
                  <table className="min-w-full divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                    <thead className="bg-[var(--bo-surface-2)]" data-slot="reportes-bg-[var(--bo-surface-2)]"><tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Factura</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Cliente</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Fecha</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Base</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">IVA</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">IVA Importe</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Total</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-[var(--bo-muted)] uppercase" data-slot="reportes-uppercase">Tipo</th>
                    </tr></thead>
                    <tbody className="bg-[var(--bo-surface)] divide-y divide-[var(--bo-border)]" data-slot="reportes-divide-[var(--bo-border)]">
                      {report.invoices.map((inv, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-[var(--bo-surface)]" : "bg-[var(--bo-surface-2)]"} data-slot="reportes-tr">
                          <td className="px-6 py-4" data-slot="reportes-py-4">{inv.invoice_number || `#${inv.id}`}</td>
                          <td className="px-6 py-4" data-slot="reportes-py-4">{inv.customer_name}</td>
                          <td className="px-6 py-4" data-slot="reportes-py-4">{formatDate(inv.invoice_date)}</td>
                          <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(inv.base_amount, "EUR")}</td>
                          <td className="px-6 py-4 text-center" data-slot="reportes-text-center">{inv.iva_rate}%</td>
                          <td className="px-6 py-4 text-right" data-slot="reportes-text-right">{formatCurrency(inv.iva_amount, "EUR")}</td>
                          <td className="px-6 py-4 text-right font-semibold" data-slot="reportes-font-semibold">{formatCurrency(inv.total, "EUR")}</td>
                          <td className="px-6 py-4 text-center" data-slot="reportes-text-center">
                            {inv.is_credit_note ? <span className="px-2 py-1 text-xs rounded-full bg-[var(--bo-warning-bg)] text-[var(--bo-color-warning)]">NC</span> : <span className="px-2 py-1 text-xs rounded-full bg-[color-mix(in_srgb,var(--bo-accent)_18%,transparent)] text-[var(--bo-accent)]">Factura</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            )}

        </>
      ) : (
        <EmptyState variant="tailwind" data-slot="reportes-text-center"
          icon={<FileText className="w-12 h-12 text-[var(--bo-faint)] mx-auto mb-4" />}
          title="No hay reporte generado"
          description="Selecciona un periodo y genera el reporte"
        >
          <button onClick={handleGenerate} disabled={loading} data-testid="reportes-generate-btn"
            className="bo-btn bo-btn--primary inline-flex items-center gap-2 disabled:opacity-50">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />} Generar Reporte
          </button>
        </EmptyState>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [rootTab, setRootTab] = useState<"iva" | "customer">("iva");
  const currentYear = data.currentYear || new Date().getFullYear();

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto p-4 sm:p-6" data-slot="reportes-mx-auto">
      <div className="flex items-center justify-between mb-6" data-slot="reportes-mb-6">
        <div data-slot="reportes-div">
          <h1 className="text-2xl font-bold text-[var(--bo-text)]" data-slot="reportes-page-title">Reportes</h1>
          <p className="text-[var(--bo-muted)]" data-slot="reportes-text-[var(--bo-muted)]">Reportes de IVA y estados de cuenta de clientes</p>
        </div>
      </div>

      <Card variant="tailwind" className="mb-6" data-slot="reportes-mb-6">
        <div className="bo-menuEditorTabs" data-testid="reportes-root-tabs">
          <Tabs
            tabs={[
              { id: "iva", label: "Reportes de IVA", href: "#" },
              { id: "customer", label: "Estado de Cuenta Cliente", href: "#" },
            ]}
            activeId={rootTab}
            ariaLabel="Secciones de reportes"
            mode="button"
            onNavigate={(_href, id) => setRootTab(id === "customer" ? "customer" : "iva")}
          />
        </div>

          {rootTab === "customer" && (
            <CustomerStatementSection api={api} customers={data.customers || []} currentYear={currentYear} />
          )}

          {rootTab === "iva" && (
            <IVAReportSection initialReport={data.report} quarterlyBreakdown={data.quarterlyBreakdown} currentYear={currentYear} api={api} />
          )}

      </Card>
    </div>
  );
}
