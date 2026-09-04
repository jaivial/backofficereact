import React, { useCallback, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, ChevronDown, ChevronUp, Database, Filter, FilterX, PieChart as PieChartIcon, Receipt, RefreshCcw, ShoppingCart, TrendingUp, Users, Utensils, WalletCards } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, RadialBar, RadialBarChart, XAxis, YAxis } from "recharts";

import type { AnalyticsCategoryRevenue, AnalyticsDayOfWeek, AnalyticsGranularity, AnalyticsHourly, AnalyticsOverview, AnalyticsOverviewParams, AnalyticsPaymentMethod, AnalyticsSummary, AnalyticsTopItem } from "../../../../../api/types";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "../../../../../ui/shadcn/chart";
import { cn } from "../../../../../ui/shadcn/utils";
import { Card } from "../../../../../ui/shell/Card";
import { TaxSimulation } from "../TaxSimulation/TaxSimulation";

const GRANULARITY_OPTIONS: Array<{ value: AnalyticsGranularity; label: string }> = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Año" },
];

const CHART_COLORS = {
  primary: "var(--bo-accent)",
  secondary: "var(--bo-accent-2)",
  tertiary: "#93efe7",
  quaternary: "#f472b6",
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#f87171",
  muted: "#6b7280",
};

const PIE_COLORS = ["#b9a8ff", "#93efe7", "#f472b6", "#fbbf24", "#4ade80", "#60a5fa"];

const revenueChartConfig = {
  invoiced: { label: "Facturado", color: "var(--bo-accent)" },
  pos: { label: "TPV", color: "var(--bo-accent-2)" },
};

const stockChartConfig = {
  purchases: { label: "Compras de stock", color: "var(--bo-accent-2)" },
  stockCost: { label: "Coste stock conocido", color: "var(--bo-accent)" },
  wasteCost: { label: "Merma conocida", color: "var(--bo-color-warning)" },
};

const categoryChartConfig = {
  amount: { label: "Ingresos", color: "var(--bo-accent)" },
};

const dayChartConfig = {
  revenue: { label: "Ingresos", color: "var(--bo-accent)" },
  covers: { label: "Comensales", color: "var(--bo-accent-2)" },
};

const hourlyChartConfig = {
  covers: { label: "Comensales", color: "var(--bo-accent)" },
  revenue: { label: "Ingresos", color: "var(--bo-accent-2)" },
};

// Cast recharts components to avoid TS issues
const AreaChartPrimitive = AreaChart as React.ComponentType<any>;
const AreaPrimitive = Area as React.ComponentType<any>;
const BarChartPrimitive = BarChart as React.ComponentType<any>;
const BarPrimitive = Bar as React.ComponentType<any>;
const LineChartPrimitive = LineChart as React.ComponentType<any>;
const LinePrimitive = Line as React.ComponentType<any>;
const PieChartPrimitive = PieChart as React.ComponentType<any>;
const PiePrimitive = Pie as React.ComponentType<any>;
const RadialBarChartPrimitive = RadialBarChart as React.ComponentType<any>;
const RadialBarPrimitive = RadialBar as React.ComponentType<any>;
const CartesianGridPrimitive = CartesianGrid as React.ComponentType<any>;
const XAxisPrimitive = XAxis as React.ComponentType<any>;
const YAxisPrimitive = YAxis as React.ComponentType<any>;
const LegendPrimitive = Legend as React.ComponentType<any>;
const CellPrimitive = Cell as React.ComponentType<any>;

export type AnalyticsDashboardProps = React.HTMLAttributes<HTMLElement> & {
  overview: AnalyticsOverview | null;
  params: AnalyticsOverviewParams;
  loading: boolean;
  error: string | null;
  onParamsChange: (params: AnalyticsOverviewParams) => void;
  onRefresh: () => void | Promise<void>;
};

const EUR_FORMATTER = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const NUMBER_FORMATTER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });

function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "N/D" : EUR_FORMATTER.format(value);
}

function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "N/D" : NUMBER_FORMATTER.format(value);
}

function formatDateLabel(value: string): string {
  return value.slice(5).replace("-", "/");
}

function knownCost(value: number | null, label: string): string {
  return label === "N/D" || value === null ? "N/D" : formatCurrency(value);
}

function hasOverviewData(overview: AnalyticsOverview): boolean {
  const summary = overview.summary;
  const hasSeriesData = overview.series.some((point) => {
    const pointSummary = point.summary;
    return Boolean(pointSummary.totalRevenueEUR || pointSummary.identifiedPeople || pointSummary.wasteQuantity || pointSummary.costCoverage.totalQuantity || pointSummary.stockPurchaseCoverage.totalQuantity || pointSummary.wasteCostEUR !== null && pointSummary.wasteQuantity > 0);
  });
  return Boolean(
    hasSeriesData ||
      summary.totalRevenueEUR ||
      summary.identifiedPeople ||
      summary.wasteQuantity ||
      summary.costCoverage.totalQuantity ||
      summary.stockPurchaseCoverage.totalQuantity ||
      summary.wasteQuantity,
  );
}

function comparisonText(key: string, comparison: AnalyticsOverview["comparison"]): string | null {
  if (!comparison) return null;
  const delta = comparison.deltaPercent[key];
  if (!Number.isFinite(delta)) return null;
  return `${delta >= 0 ? "+" : ""}${formatNumber(delta)}% vs periodo anterior`;
}

export function AnalyticsDashboard({
  overview: realOverview,
  params,
  loading,
  error,
  onParamsChange,
  onRefresh,
  className,
  ...props
}: AnalyticsDashboardProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const reduceMotion = useReducedMotion();

  // Real data only: no synthetic fallbacks. If the backend returns no data
  // for the period, the dashboard shows an explicit empty state.
  const overview = realOverview;
  const hasAnyData = useMemo(() => Boolean(overview && hasOverviewData(overview)), [overview]);

  const summary = overview?.summary ?? null;

  const revenueSeries = useMemo(
    () => (overview?.series ?? []).map((point) => ({
      period: formatDateLabel(point.from),
      invoiced: point.summary.invoicedRevenueEUR,
      pos: point.summary.posRevenueEUR,
    })),
    [overview],
  );

  const stockSeries = useMemo(
    () => (overview?.series ?? []).map((point) => ({
      period: formatDateLabel(point.from),
      purchases: point.summary.stockPurchasesEUR,
      stockCost: point.summary.costOfGoodsEUR,
      wasteCost: point.summary.wasteCostEUR,
    })),
    [overview],
  );

  const averageSpend = (summary?.identifiedPeople ?? 0) > 0 && summary ? summary.totalRevenueEUR / summary.identifiedPeople : null;

  // Breakdown datasets come straight from the backend. Empty arrays are
  // rendered as explicit empty states instead of invented numbers.
  const categorySeries = useMemo(
    () => (overview?.revenueByCategory ?? []).map((entry: AnalyticsCategoryRevenue) => ({ category: entry.category, amount: entry.amountEUR })),
    [overview],
  );

  const paymentSeries = useMemo(
    () => (overview?.paymentMethods ?? []).map((entry: AnalyticsPaymentMethod) => ({ method: entry.method, amount: entry.amountEUR, count: entry.count })),
    [overview],
  );

  const daySeries = useMemo(
    () => (overview?.dayOfWeek ?? []).map((entry: AnalyticsDayOfWeek) => ({ day: entry.day, revenue: entry.revenueEUR, covers: entry.covers })),
    [overview],
  );

  const hourlySeries = useMemo(
    () => (overview?.hourlyDistribution ?? []).map((entry: AnalyticsHourly) => ({ hour: entry.hour, covers: entry.covers, revenue: entry.revenueEUR })),
    [overview],
  );

  const topItems = useMemo(
    () => (overview?.topItems ?? []).map((entry: AnalyticsTopItem) => ({ name: entry.name, quantity: entry.quantity, revenue: entry.revenueEUR })),
    [overview],
  );

  // Coverage data for radial chart
  const coverageData = useMemo(() => {
    const quality = overview?.dataQuality;
    if (!quality) return [];
    return [
      { name: "Coste stock", value: quality.costCoverage.percent, fill: CHART_COLORS.primary },
      { name: "Compras", value: quality.stockPurchaseCoverage.percent, fill: CHART_COLORS.secondary },
      { name: "Merma", value: quality.wasteCostCoverage.percent, fill: CHART_COLORS.tertiary },
    ];
  }, [overview]);

  const handleDateChange = useCallback(
    (key: "from" | "to", value: string) => {
      onParamsChange({ ...params, [key]: value });
    },
    [onParamsChange, params],
  );

  const handleGranularityChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      onParamsChange({ ...params, granularity: event.target.value as AnalyticsGranularity });
    },
    [onParamsChange, params],
  );

  const handleCompareChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onParamsChange({ ...params, compare: event.target.checked ? "previous" : undefined });
    },
    [onParamsChange, params],
  );

  const handleResetFilters = useCallback(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    onParamsChange({
      from: thirtyDaysAgo.toISOString().split("T")[0],
      to: today.toISOString().split("T")[0],
      granularity: "day",
      compare: undefined,
    });
  }, [onParamsChange]);

  const hasActiveFilters = useMemo(() => {
    return params.granularity !== "day" || params.compare === "previous";
  }, [params]);

  const tooltipFormatter = useCallback((value: unknown) => {
    if (value === null || value === undefined || value === "") return "N/D";
    return formatCurrency(typeof value === "number" ? value : Number(value));
  }, []);

  const toggleFilters = useCallback(() => setFiltersExpanded((prev) => !prev), []);

  return (
    <section className={cn("mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-4 pb-4 text-[var(--bo-text)] sm:px-6 sm:pb-6 xl:px-8 xl:pb-8", className)} data-ui="analytics-dashboard" {...props}>
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-ui="analytics-dashboard-header">
        <div className="min-w-0" data-ui="analytics-dashboard-heading">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bo-accent-2)]" data-ui="analytics-dashboard-eyebrow">Control financiero</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-ui="analytics-dashboard-title">Estadísticas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--bo-muted)]" data-ui="analytics-dashboard-description">Ingresos facturados y TPV, personas identificadas y coste real de stock.</p>
        </div>
      </header>

      {/* Collapsible Filters */}
      <Card variant="glass" data-ui="analytics-filters-accordion">
        <div className="flex items-center justify-between gap-4 p-4" data-ui="analytics-filters-header">
          <div className="flex items-center gap-3" data-ui="analytics-filters-title">
            <Filter size={15} className="text-[var(--bo-muted)]" data-ui="analytics-filters-icon" />
            <span className="text-sm font-medium" data-role="analytics-filters-label">Filtros</span>
            <span className="rounded-full border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-2.5 py-0.5 text-xs font-medium text-[var(--bo-muted)]" data-ui="analytics-currency-badge">EUR</span>
          </div>
          <div className="flex items-center gap-2" data-ui="analytics-filters-actions">
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--bo-accent)] px-3 text-sm font-semibold text-[var(--bo-on-accent)] transition-[filter,opacity] duration-[var(--bo-transition-base)] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bo-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              onClick={() => void onRefresh()}
              disabled={loading}
              aria-label="Actualizar estadísticas"
              data-testid="analytics-refresh"
              data-ui="analytics-refresh-button"
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" data-ui="analytics-refresh-icon" />
              <span className="hidden sm:inline" data-ui="analytics-refresh-label">Actualizar</span>
            </button>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] text-[var(--bo-muted)] transition-colors hover:bg-[var(--bo-surface-2)]"
              type="button"
              onClick={toggleFilters}
              aria-expanded={filtersExpanded}
              aria-label={filtersExpanded ? "Colapsar filtros" : "Expandir filtros"}
              data-testid="analytics-filters-toggle"
              data-ui="analytics-filters-toggle"
            >
              {filtersExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {filtersExpanded ? (
            <motion.div
              key="expanded-filters"
              style={{ overflow: "hidden" }}
              initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
              animate={{ opacity: 1, height: "auto", y: 0 }}
              exit={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0, y: -6 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
              data-ui="analytics-filters-expandable"
            >
              <div className="border-t border-[var(--bo-border)] p-4" data-ui="analytics-filters-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5" data-ui="analytics-filters-grid">
                  <label className="flex min-w-0 flex-col gap-1.5" data-ui="analytics-filter-from">
                    <span data-slot="analyticsDashboard-text-[var(-bo" className="text-xs font-medium text-[var(--bo-muted)]">Desde</span>
                    <input
                      className="h-10 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-text)] outline-none transition-[border-color,box-shadow] duration-[var(--bo-transition-base)] focus-visible:border-[var(--bo-accent)] focus-visible:ring-2 focus-visible:ring-[var(--bo-accent)]/30"
                      type="date"
                      value={params.from}
                      onChange={(event) => handleDateChange("from", event.target.value)}
                      aria-label="Fecha desde"
                      data-testid="analytics-from"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5" data-ui="analytics-filter-to">
                    <span data-slot="analyticsDashboard-text-[var(-bo" className="text-xs font-medium text-[var(--bo-muted)]">Hasta</span>
                    <input
                      className="h-10 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-text)] outline-none transition-[border-color,box-shadow] duration-[var(--bo-transition-base)] focus-visible:border-[var(--bo-accent)] focus-visible:ring-2 focus-visible:ring-[var(--bo-accent)]/30"
                      type="date"
                      value={params.to}
                      onChange={(event) => handleDateChange("to", event.target.value)}
                      aria-label="Fecha hasta"
                      data-testid="analytics-to"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5" data-ui="analytics-filter-granularity">
                    <span data-slot="analyticsDashboard-text-[var(-bo" className="text-xs font-medium text-[var(--bo-muted)]">Agrupación</span>
                    <select
                      className="h-10 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-text)] outline-none transition-[border-color,box-shadow] duration-[var(--bo-transition-base)] focus-visible:border-[var(--bo-accent)] focus-visible:ring-2 focus-visible:ring-[var(--bo-accent)]/30"
                      value={params.granularity}
                      onChange={handleGranularityChange}
                      aria-label="Granularidad"
                      data-testid="analytics-granularity"
                    >
                      {GRANULARITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                  <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-muted)]" data-ui="analytics-filter-compare">
                    <input
                      className="h-4 w-4 accent-[var(--bo-accent)]"
                      type="checkbox"
                      checked={params.compare === "previous"}
                      onChange={handleCompareChange}
                      aria-label="Comparar con periodo anterior"
                      data-testid="analytics-compare"
                    />
                    <span data-slot="analyticsDashboard-span">Comparar periodo anterior</span>
                  </label>
                  <div className="flex items-end" data-ui="analytics-filters-clear">
                    <button
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-3 text-sm text-[var(--bo-muted)] transition-colors hover:bg-[var(--bo-surface-2)]",
                        !hasActiveFilters && "invisible",
                      )}
                      type="button"
                      onClick={handleResetFilters}
                      disabled={!hasActiveFilters}
                      data-ui="analytics-clear-filters"
                    >
                      <FilterX size={15} />
                      <span data-slot="analyticsDashboard-span">Limpiar</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Card>

      {loading ? <LoadingState data-ui="analytics-loading-state" /> : null}
      {!loading && error ? <ErrorState message={error} data-ui="analytics-error-state" /> : null}

      {!loading && !error && overview ? (
        hasAnyData ? (
          <div className="flex flex-col gap-5" data-testid="analytics-populated" data-ui="analytics-populated">
          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" data-ui="analytics-kpis">
            <KpiCard label="Ingresos facturados" value={formatCurrency(overview.summary.invoicedRevenueEUR)} detail="Facturas emitidas en EUR" testId="analytics-invoiced-revenue" icon={<Receipt className="h-4 w-4" aria-hidden="true" />} trend={comparisonText("invoicedRevenueEUR", overview.comparison)} />
            <KpiCard label="Ingresos TPV" value={formatCurrency(overview.summary.posRevenueEUR)} detail="Ventas punto de venta en EUR" testId="analytics-pos-revenue" icon={<ShoppingCart className="h-4 w-4" aria-hidden="true" />} trend={comparisonText("posRevenueEUR", overview.comparison)} />
            <KpiCard label="Personas identificadas" value={formatNumber(overview.summary.identifiedPeople)} detail="Personas únicas con identidad" testId="analytics-identified-people" icon={<Users className="h-4 w-4" aria-hidden="true" />} trend={comparisonText("identifiedPeople", overview.comparison)} />
            <KpiCard label="Gasto medio identificado" value={formatCurrency(averageSpend)} detail="Ingresos totales / personas identificadas" testId="analytics-average-spend" icon={<WalletCards className="h-4 w-4" aria-hidden="true" />} />
            <KpiCard label="Compras de stock" value={knownCost(overview.summary.stockPurchasesEUR, overview.summary.stockPurchasesLabel)} detail="Gasto conocido de compras" testId="analytics-stock-purchases" icon={<Database className="h-4 w-4" aria-hidden="true" />} trend={comparisonText("stockPurchasesEUR", overview.comparison)} />
          </div>

          {/* Row 1: Revenue Area + Quality Panel */}
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]" data-ui="analytics-primary-grid">
            <AnalyticsPanel title="Ingresos por periodo" description="Facturado y TPV permanecen separados." icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />} testId="analytics-revenue-panel">
              <ChartContainer className="h-72 min-h-60" config={revenueChartConfig} id="analytics-revenue" data-testid="analytics-revenue-chart">
                <AreaChartPrimitive data={revenueSeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analytics-invoiced-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-invoiced)" stopOpacity={0.34} />
                      <stop offset="95%" stopColor="var(--color-invoiced)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analytics-pos-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-pos)" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="var(--color-pos)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                  <XAxisPrimitive dataKey="period" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                  <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} tickFormatter={(value: number) => `${value} €`} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => tooltipFormatter(value)} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <AreaPrimitive dataKey="invoiced" type="monotone" stroke="var(--color-invoiced)" fill="url(#analytics-invoiced-fill)" strokeWidth={2} fillOpacity={1} dot={false} />
                  <AreaPrimitive dataKey="pos" type="monotone" stroke="var(--color-pos)" fill="url(#analytics-pos-fill)" strokeWidth={2} fillOpacity={1} dot={false} />
                </AreaChartPrimitive>
              </ChartContainer>
            </AnalyticsPanel>

            <QualityPanel summary={overview.summary} quality={overview.dataQuality} />
          </div>

          {/* Row 2: Revenue by Category (Bar) standalone */}
          <div className="grid gap-5" data-ui="analytics-category-row">
            <AnalyticsPanel title="Ingresos por categoría" description="Distribución de ventas por tipo de producto." icon={<Utensils className="h-4 w-4" aria-hidden="true" />} testId="analytics-category-panel">
              {categorySeries.length ? (
                <ChartContainer className="h-72 min-h-60" config={categoryChartConfig} id="analytics-category" data-testid="analytics-category-chart">
                  <BarChartPrimitive data={categorySeries} layout="vertical" margin={{ top: 12, right: 12, left: 80, bottom: 0 }}>
                    <CartesianGridPrimitive horizontal={false} stroke="var(--bo-border)" />
                    <XAxisPrimitive type="number" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k €`} />
                    <YAxisPrimitive type="category" dataKey="category" tickLine={false} axisLine={false} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} width={75} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => tooltipFormatter(value)} />} />
                    <BarPrimitive dataKey="amount" fill="var(--bo-accent)" radius={[0, 4, 4, 0]} />
                  </BarChartPrimitive>
                </ChartContainer>
              ) : <ChartEmpty message="Sin ventas por categoría en el periodo." />}
            </AnalyticsPanel>
          </div>

          {/* Row 3: Payment Methods (Pie) + Payment Totals */}
          <div className="grid gap-5 lg:grid-cols-2" data-ui="analytics-payment-row">
            <AnalyticsPanel title="Métodos de pago" description="Distribución por forma de pago." icon={<PieChartIcon className="h-4 w-4" aria-hidden="true" />} testId="analytics-payment-panel">
              {paymentSeries.length ? (
                <ChartContainer className="h-72 min-h-60" config={{}} id="analytics-payment" data-testid="analytics-payment-chart">
                  <PieChartPrimitive>
                    <PiePrimitive
                      data={paymentSeries}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      innerRadius={40}
                      dataKey="amount"
                      nameKey="method"
                      label={({ method, percent }: { method: string; percent: number }) => `${method} ${(percent * 100).toFixed(0)}%`}
                    >
                      {paymentSeries.map((entry, index) => (
                        <CellPrimitive key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </PiePrimitive>
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => tooltipFormatter(value)} />} />
                  </PieChartPrimitive>
                </ChartContainer>
              ) : <ChartEmpty message="Sin pagos capturados en el periodo." />}
            </AnalyticsPanel>

            <AnalyticsPanel title="Totales por método de pago" description="Importe y operaciones por forma de pago en el periodo." icon={<WalletCards className="h-4 w-4" aria-hidden="true" />} testId="analytics-payment-totals-panel">
              {paymentSeries.length ? (
                <>
                  <div className="flex flex-col gap-2" data-ui="analytics-payment-totals-list">
                    {paymentSeries.map((entry, index) => {
                      const total = paymentSeries.reduce((acc, item) => acc + item.amount, 0);
                      const pct = total > 0 ? (entry.amount / total) * 100 : 0;
                      return (
                        <Card key={entry.method} variant="glass" data-ui={`analytics-payment-total-${index}`}>
                          <div className="flex items-center justify-between gap-3" data-ui={`analytics-payment-total-row-${index}`}>
                            <div className="flex min-w-0 items-center gap-2.5" data-ui={`analytics-payment-total-name-${index}`}>
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} aria-hidden="true" data-ui={`analytics-payment-total-dot-${index}`} />
                              <span className="truncate text-sm font-medium" data-ui={`analytics-payment-total-label-${index}`}>{entry.method}</span>
                            </div>
                            <span className="shrink-0 text-sm font-semibold" data-ui={`analytics-payment-total-value-${index}`}>{formatCurrency(entry.amount)}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs" data-ui={`analytics-payment-total-meta-${index}`}>
                            <span className="text-[var(--bo-muted)]" data-ui={`analytics-payment-total-count-${index}`}>{formatNumber(entry.count)} operaciones</span>
                            <span className="text-[var(--bo-faint)]" data-ui={`analytics-payment-total-pct-${index}`}>{formatNumber(pct)}% del total</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bo-border)]" data-ui={`analytics-payment-total-bar-${index}`}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} data-ui={`analytics-payment-total-bar-fill-${index}`} />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--bo-border)] pt-3" data-ui="analytics-payment-total-footer">
                    <span className="text-sm text-[var(--bo-muted)]" data-ui="analytics-payment-total-footer-label">Total periodo</span>
                    <strong className="text-sm font-semibold" data-ui="analytics-payment-total-footer-value">
                      {formatCurrency(paymentSeries.reduce((acc, item) => acc + item.amount, 0))}
                    </strong>
                  </div>
                </>
              ) : <ChartEmpty message="Sin pagos capturados en el periodo." />}
            </AnalyticsPanel>
          </div>

          {/* Row 3: Day of Week (Bar) + Hourly Distribution (Line) */}
          <div className="grid gap-5 lg:grid-cols-2" data-ui="analytics-time-row">
            <AnalyticsPanel title="Rendimiento por día" description="Ingresos y comensales por día de la semana." icon={<BarChart3 className="h-4 w-4" aria-hidden="true" />} testId="analytics-day-panel">
              {daySeries.length ? (
                <ChartContainer className="h-72 min-h-60" config={dayChartConfig} id="analytics-day" data-testid="analytics-day-chart">
                  <BarChartPrimitive data={daySeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                    <XAxisPrimitive dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                    <YAxisPrimitive yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} tickFormatter={(value: number) => `${value} €`} />
                    <YAxisPrimitive yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <BarPrimitive yAxisId="left" dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
                    <BarPrimitive yAxisId="right" dataKey="covers" fill="var(--color-covers)" radius={[4, 4, 0, 0]} />
                  </BarChartPrimitive>
                </ChartContainer>
              ) : <ChartEmpty message="Sin visitas cerradas con pago en el periodo." />}
            </AnalyticsPanel>

            <AnalyticsPanel title="Distribución horaria" description="Comensales e ingresos por hora del servicio." icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} testId="analytics-hourly-panel">
              {hourlySeries.length ? (
                <ChartContainer className="h-72 min-h-60" config={hourlyChartConfig} id="analytics-hourly" data-testid="analytics-hourly-chart">
                  <LineChartPrimitive data={hourlySeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                    <XAxisPrimitive dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                    <YAxisPrimitive yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                    <YAxisPrimitive yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} tickFormatter={(value: number) => `${value} €`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <LinePrimitive yAxisId="left" type="monotone" dataKey="covers" stroke="var(--color-covers)" strokeWidth={2} dot={{ fill: "var(--color-covers)", r: 3 }} />
                    <LinePrimitive yAxisId="right" type="monotone" dataKey="revenue" stroke="var(--color-revenue)" strokeWidth={2} dot={{ fill: "var(--color-revenue)", r: 3 }} />
                  </LineChartPrimitive>
                </ChartContainer>
              ) : <ChartEmpty message="Sin visitas con ticket pagado en el periodo." />}
            </AnalyticsPanel>
          </div>

          {/* Row 4: Stock Cost Area + Margin Analysis */}
          <div className="grid gap-5 lg:grid-cols-2" data-ui="analytics-cost-row">
            <AnalyticsPanel title="Coste de stock y merma" description="Costes conocidos trazados; importes incompletos se muestran como N/D." icon={<Database className="h-4 w-4" aria-hidden="true" />} testId="analytics-stock-panel">
              <ChartContainer className="h-72 min-h-60" config={stockChartConfig} id="analytics-stock" data-testid="analytics-stock-chart">
                <AreaChartPrimitive data={stockSeries} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analytics-stock-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-stockCost)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-stockCost)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analytics-purchases-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-purchases)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-purchases)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="analytics-waste-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-wasteCost)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-wasteCost)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                  <XAxisPrimitive dataKey="period" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                  <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} tickFormatter={(value: number) => `${value} €`} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent formatter={(value) => tooltipFormatter(value)} />} />
                  <ChartLegend content={<ChartLegendContent />} />
                  <AreaPrimitive dataKey="purchases" type="monotone" stroke="var(--color-purchases)" fill="url(#analytics-purchases-fill)" strokeWidth={2} fillOpacity={1} dot={false} />
                  <AreaPrimitive dataKey="stockCost" type="monotone" stroke="var(--color-stockCost)" fill="url(#analytics-stock-fill)" strokeWidth={2} fillOpacity={1} dot={false} />
                  <AreaPrimitive dataKey="wasteCost" type="monotone" stroke="var(--color-wasteCost)" fill="url(#analytics-waste-fill)" strokeWidth={2} fillOpacity={1} dot={false} />
                </AreaChartPrimitive>
              </ChartContainer>
            </AnalyticsPanel>

            <AnalyticsPanel title="Análisis de márgenes" description="Margen bruto por categoría de producto." icon={<TrendingUp className="h-4 w-4" aria-hidden="true" />} testId="analytics-margin-panel">
              <ChartEmpty message="El margen por categoría aún no está disponible; usa el simulador fiscal para estimar el resultado." />
            </AnalyticsPanel>
          </div>

          {/* Row 5: Coverage Radial + Top Items + Waste Breakdown */}
          <div className="grid gap-5 lg:grid-cols-3" data-ui="analytics-detail-row">
            <AnalyticsPanel title="Cobertura de datos" description="Porcentaje de items con coste conocido." icon={<Database className="h-4 w-4" aria-hidden="true" />} testId="analytics-coverage-panel">
              <ChartContainer className="h-64 min-h-56" config={{}} id="analytics-coverage" data-testid="analytics-coverage-chart">
                <RadialBarChartPrimitive cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={coverageData} startAngle={180} endAngle={0}>
                  <RadialBarPrimitive minAngle={15} background clockWise dataKey="value" cornerRadius={4} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
                  <LegendPrimitive iconSize={10} layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                </RadialBarChartPrimitive>
              </ChartContainer>
            </AnalyticsPanel>

            <AnalyticsPanel title="Top productos" description="Productos más vendidos del periodo." icon={<Utensils className="h-4 w-4" aria-hidden="true" />} testId="analytics-top-items-panel">
              {topItems.length ? (
                <div className="max-h-64 overflow-y-auto" data-ui="analytics-top-items-list">
                  <table data-slot="analyticsDashboard-text-sm" className="w-full text-left text-sm">
                    <thead data-slot="analyticsDashboard-text-[var(-bo" className="sticky top-0 border-b border-[var(--bo-border)] bg-[var(--bo-surface)] text-xs uppercase tracking-wide text-[var(--bo-muted)]">
                      <tr data-slot="analyticsDashboard-tr">
                        <th data-slot="analyticsDashboard-font-medium" className="pb-3 pr-3 font-medium">Producto</th>
                        <th data-slot="analyticsDashboard-text-right" className="pb-3 pr-3 font-medium text-right">Uds</th>
                        <th data-slot="analyticsDashboard-text-right" className="pb-3 font-medium text-right">Ingresos</th>
                      </tr>
                    </thead>
                    <tbody data-slot="analyticsDashboard-tbody">
                      {topItems.map((item, index) => (
                        <tr data-slot="analyticsDashboard-last:border-0" className="border-b border-[var(--bo-border)] last:border-0" key={index}>
                          <td data-slot="analyticsDashboard-font-medium" className="py-2.5 pr-3 font-medium">{item.name}</td>
                          <td data-slot="analyticsDashboard-text-[var(-bo" className="py-2.5 pr-3 text-right text-[var(--bo-muted)]">{formatNumber(item.quantity)}</td>
                          <td data-slot="analyticsDashboard-font-medium" className="py-2.5 text-right font-medium">{formatCurrency(item.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <ChartEmpty message="Sin ventas de producto en el periodo." />}
            </AnalyticsPanel>

            <WasteBreakdown overview={overview} />
          </div>

          {/* Row 6: Tax simulation */}
          <div data-ui="analytics-tax-row">
            <TaxSimulation
              grossRevenue={overview.summary.totalRevenueEUR}
              stockPurchases={overview.summary.stockPurchasesEUR ?? 0}
              data-ui="analytics-tax-simulation"
            />
          </div>

          {/* Row 7: Comparison Panel (if enabled) */}
          {overview.comparison ? (
            <div className="grid gap-5 lg:grid-cols-2" data-ui="analytics-comparison-row">
              <ComparisonPanel overview={overview} />
              <DataQualityNote quality={overview.dataQuality} />
            </div>
          ) : null}
        </div>
        ) : (
          <EmptyDataState />
        )
      ) : null}
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-72 min-h-60 items-center justify-center rounded-xl border border-dashed border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] px-6 text-center text-sm leading-6 text-[var(--bo-muted)]" data-ui="analytics-chart-empty">
      {message}
    </div>
  );
}

function EmptyDataState() {
  return (
    <Card variant="glass" className="text-center" data-testid="analytics-empty-state" data-ui="analytics-empty-state">
      <BarChart3 className="mx-auto h-8 w-8 text-[var(--bo-faint)]" aria-hidden="true" />
      <h2 data-slot="analyticsDashboard-font-semibold" className="mt-3 font-semibold">Sin datos en el periodo</h2>
      <p data-slot="analyticsDashboard-text-[var(-bo" className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--bo-muted)]">
        No hay facturas, tickets de TPV ni rollups para el rango seleccionado. Ajusta las fechas o pulsa “Actualizar” para regenerar los rollups.
      </p>
    </Card>
  );
}

function KpiCard({ label, value, detail, testId, icon, trend }: { label: string; value: string; detail: string; testId: string; icon: React.ReactNode; trend?: string | null }) {
  return (
    <Card variant="glass" className="flex h-full flex-col justify-between" style={{ minHeight: 142 }} data-testid={testId}>
      <div data-slot="analyticsDashboard-gap-3" className="flex items-start justify-between gap-3">
        <span data-slot="analyticsDashboard-text-[var(-bo" className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]">{label}</span>
        <span data-slot="analyticsDashboard-text-[var(-bo" className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true">{icon}</span>
      </div>
      <div data-slot="analyticsDashboard-div">
        <div data-slot="analyticsDashboard-tracking-tight" className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-1 text-xs leading-5 text-[var(--bo-muted)]">{detail}</p>
        {trend ? <p className={cn("mt-2 text-xs font-medium", trend.startsWith("-") ? "text-[var(--bo-on-surface-danger)]" : "text-[var(--bo-on-surface-success)]")}>{trend}</p> : null}
      </div>
    </Card>
  );
}

function AnalyticsPanel({ title, description, icon, testId, children }: { title: string; description: string; icon: React.ReactNode; testId: string; children: React.ReactNode }) {
  return (
    <Card variant="glass" data-testid={testId}>
      <div data-slot="analyticsDashboard-mb-4" className="mb-4">
        <div data-slot="analyticsDashboard-gap-3" className="flex items-center gap-3">
          <span data-slot="analyticsDashboard-text-[var(-bo" className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true">{icon}</span>
          <h2 data-slot="analyticsDashboard-font-semibold" className="font-semibold" style={{ margin: 0 }}>{title}</h2>
        </div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-xs leading-5 text-[var(--bo-muted)]">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function QualityPanel({ summary, quality }: { summary: AnalyticsSummary; quality: AnalyticsOverview["dataQuality"] }) {
  return (
    <Card variant="glass" data-testid="analytics-quality">
      <div data-slot="analyticsDashboard-mb-4" className="mb-4">
        <div data-slot="analyticsDashboard-gap-3" className="flex items-center gap-3">
          <span data-slot="analyticsDashboard-text-[var(-bo" className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true"><Database className="h-4 w-4" /></span>
          <h2 data-slot="analyticsDashboard-font-semibold" className="font-semibold" style={{ margin: 0 }}>Calidad del dato</h2>
        </div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-xs leading-5 text-[var(--bo-muted)]">Cobertura visible para no confundir desconocido con cero.</p>
      </div>
      <div data-slot="analyticsDashboard-sm:grid-cols-2" className="grid gap-3 sm:grid-cols-2">
        <QualityMetric label="Cobertura coste stock" value={`${formatNumber(quality.costCoverage.percent)}%`} detail={`${formatNumber(quality.unknownCostQuantity)} unidades sin coste`} />
        <QualityMetric label="Cobertura compras" value={`${formatNumber(quality.stockPurchaseCoverage.percent)}%`} detail={`${formatNumber(quality.unknownPurchaseQuantity)} unidades sin coste`} />
        <QualityMetric label="Cobertura merma" value={`${formatNumber(quality.wasteCostCoverage.percent)}%`} detail={`${formatNumber(quality.unknownWasteQuantity)} unidades sin coste`} />
        <QualityMetric label="Documentos sin identidad" value={formatNumber(quality.unidentifiedDocuments)} detail="No cuentan como personas identificadas" />
      </div>
      <Card variant="glass" className="mt-4">
        <div data-slot="analyticsDashboard-text-xs" className="flex items-center justify-between gap-3 text-xs">
          <span data-slot="analyticsDashboard-text-[var(-bo" className="text-[var(--bo-muted)]">Coste stock presentado</span>
          <strong className="font-semibold">{knownCost(summary.costOfGoodsEUR, summary.costOfGoodsLabel)}</strong>
        </div>
        <div data-slot="analyticsDashboard-text-xs" className="mt-2 flex items-center justify-between gap-3 text-xs">
          <span data-slot="analyticsDashboard-text-[var(-bo" className="text-[var(--bo-muted)]">Coste merma presentado</span>
          <strong className="font-semibold" data-testid="analytics-waste-cost">{knownCost(summary.wasteCostEUR, summary.wasteCostLabel)}</strong>
        </div>
      </Card>
      {quality.refreshRequired ? <p className="mt-3 text-xs font-medium text-[var(--bo-on-surface-warning)]" role="status">Actualización recomendada para completar rollups del periodo.</p> : null}
    </Card>
  );
}

function QualityMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card variant="glass">
      <div data-slot="analyticsDashboard-text-[var(-bo" className="text-xs text-[var(--bo-muted)]">{label}</div>
      <div data-slot="analyticsDashboard-font-semibold" className="mt-1 text-lg font-semibold">{value}</div>
      <div data-slot="analyticsDashboard-text-[var(-bo" className="mt-1 text-xs text-[var(--bo-faint)]">{detail}</div>
    </Card>
  );
}

function WasteBreakdown({ overview }: { overview: AnalyticsOverview }) {
  return (
    <Card variant="glass" data-testid="analytics-waste-breakdown">
      <div data-slot="analyticsDashboard-mb-4" className="mb-4">
        <div data-slot="analyticsDashboard-gap-3" className="flex items-center gap-3">
          <span data-slot="analyticsDashboard-text-[var(-bo" className="rounded-lg bg-[var(--bo-warning-bg)] p-2 text-[var(--bo-on-surface-warning)]" aria-hidden="true"><AlertTriangle className="h-4 w-4" /></span>
          <h2 data-slot="analyticsDashboard-font-semibold" className="font-semibold" style={{ margin: 0 }}>Desglose de merma</h2>
        </div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-xs leading-5 text-[var(--bo-muted)]">Incluye receta y producción.</p>
      </div>
      {overview.wasteBreakdown.length ? (
        <div data-slot="analyticsDashboard-overflow-y-auto" className="max-h-48 overflow-y-auto">
          <table data-slot="analyticsDashboard-text-sm" className="w-full text-left text-sm">
            <thead data-slot="analyticsDashboard-text-[var(-bo" className="sticky top-0 border-b border-[var(--bo-border)] bg-[var(--bo-surface)] text-xs uppercase tracking-wide text-[var(--bo-muted)]">
              <tr data-slot="analyticsDashboard-tr">
                <th data-slot="analyticsDashboard-font-medium" className="pb-3 pr-3 font-medium">Motivo</th>
                <th data-slot="analyticsDashboard-font-medium" className="pb-3 pr-3 font-medium">Cantidad</th>
                <th data-slot="analyticsDashboard-font-medium" className="pb-3 font-medium">Coste</th>
              </tr>
            </thead>
            <tbody data-slot="analyticsDashboard-tbody">
              {overview.wasteBreakdown.map((entry, index) => (
                <tr data-slot="analyticsDashboard-last:border-0" className="border-b border-[var(--bo-border)] last:border-0" key={`${entry.reason}-${index}`}>
                  <td data-slot="analyticsDashboard-font-medium" className="py-2 pr-3 font-medium">{entry.reason}</td>
                  <td data-slot="analyticsDashboard-text-[var(-bo" className="py-2 pr-3 text-[var(--bo-muted)]">{formatNumber(entry.quantity)}</td>
                  <td data-slot="analyticsDashboard-font-medium" className="py-2 font-medium">{knownCost(entry.knownCostEUR, entry.costLabel)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="text-sm text-[var(--bo-muted)]">Sin merma registrada en periodo.</p>}
    </Card>
  );
}

function ComparisonPanel({ overview }: { overview: AnalyticsOverview }) {
  const comparison = overview.comparison;
  if (!comparison) return null;
  return (
    <Card variant="glass" data-testid="analytics-comparison">
      <div data-slot="analyticsDashboard-mb-4" className="mb-4">
        <h2 data-slot="analyticsDashboard-font-semibold" className="font-semibold" style={{ margin: 0 }}>Periodo anterior</h2>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-xs leading-5 text-[var(--bo-muted)]">{comparison.from} → {comparison.to}</p>
      </div>
      <div data-slot="analyticsDashboard-sm:grid-cols-2" className="grid gap-3 sm:grid-cols-2">
        <ComparisonMetric label="Ingresos totales" value={formatCurrency(comparison.summary.totalRevenueEUR)} delta={comparison.deltaPercent.totalRevenueEUR} />
        <ComparisonMetric label="Personas identificadas" value={formatNumber(comparison.summary.identifiedPeople)} delta={comparison.deltaPercent.identifiedPeople} />
        <ComparisonMetric label="Ingresos facturados" value={formatCurrency(comparison.summary.invoicedRevenueEUR)} delta={comparison.deltaPercent.invoicedRevenueEUR} />
        <ComparisonMetric label="Ingresos TPV" value={formatCurrency(comparison.summary.posRevenueEUR)} delta={comparison.deltaPercent.posRevenueEUR} />
      </div>
    </Card>
  );
}

function ComparisonMetric({ label, value, delta }: { label: string; value: string; delta?: number }) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  return (
    <Card variant="glass">
      <div data-slot="analyticsDashboard-text-[var(-bo" className="text-xs text-[var(--bo-muted)]">{label}</div>
      <div data-slot="analyticsDashboard-font-semibold" className="mt-1 text-lg font-semibold">{value}</div>
      {hasDelta ? <div className={cn("mt-1 text-xs font-medium", delta >= 0 ? "text-[var(--bo-on-surface-success)]" : "text-[var(--bo-on-surface-danger)]")}>{delta >= 0 ? "+" : ""}{formatNumber(delta)}%</div> : null}
    </Card>
  );
}

function DataQualityNote({ quality }: { quality: AnalyticsOverview["dataQuality"] }) {
  return (
    <Card variant="glass">
      <div data-slot="analyticsDashboard-mb-4" className="mb-4">
        <div data-slot="analyticsDashboard-gap-3" className="flex items-center gap-3">
          <Database className="h-4 w-4 shrink-0 text-[var(--bo-accent-2)]" aria-hidden="true" />
          <h2 data-slot="analyticsDashboard-font-semibold" className="font-semibold" style={{ margin: 0 }}>Nota de calidad</h2>
        </div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-sm leading-6 text-[var(--bo-muted)]">
          Datos disponibles en EUR. Cobertura de coste: {formatNumber(quality.costCoverage.percent)}%; las cantidades sin coste permanecen como N/D.
        </p>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-2 text-sm leading-6 text-[var(--bo-muted)]">
          Documentos no EUR: {formatNumber(quality.nonEurDocuments)}. Documentos sin identidad: {formatNumber(quality.unidentifiedDocuments)}.
        </p>
      </div>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4" aria-live="polite" aria-busy="true" data-testid="analytics-loading">
      <span data-slot="analyticsDashboard-sr-only" className="sr-only">Cargando estadísticas</span>
      <div data-slot="analyticsDashboard-xl:grid-cols-5" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {["one", "two", "three", "four", "five"].map((key) => <div className="h-36 animate-pulse rounded-2xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" key={key} />)}
      </div>
      <div data-slot="analyticsDashboard-bg-[var(-bo" className="h-80 animate-pulse rounded-2xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" />
      <div data-slot="analyticsDashboard-lg:grid-cols-2" className="grid gap-5 lg:grid-cols-2">
        <div data-slot="analyticsDashboard-bg-[var(-bo" className="h-80 animate-pulse rounded-2xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" />
        <div data-slot="analyticsDashboard-bg-[var(-bo" className="h-80 animate-pulse rounded-2xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card variant="glass" role="alert" data-testid="analytics-error">
      <div data-slot="analyticsDashboard-div">
        <div data-slot="analyticsDashboard-gap-3" className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-[var(--bo-on-surface-danger)]" aria-hidden="true" />
          <h2 data-slot="analyticsDashboard-text-[var(-bo" className="font-semibold text-[var(--bo-on-surface-danger)]" style={{ margin: 0 }}>No se pudieron cargar las estadísticas</h2>
        </div>
        <p data-slot="analyticsDashboard-text-[var(-bo" className="mt-[0.4rem] text-sm text-[var(--bo-muted)]">{message}</p>
      </div>
    </Card>
  );
}
