import React, { useMemo } from "react";
import { cn } from "../shadcn/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import type {
  InvoiceAnalytics,
  InvoiceStatus,
  PaymentMethod,
} from "../../api/types";

// Color palette
const COLORS = {
  primary: "#b9a8ff",
  secondary: "#93efe7",
  tertiary: "#cfeff0",
  success: "#4ade80",
  warning: "#fbbf24",
  error: "#f87171",
  info: "#60a5fa",
  muted: "#6b7280",
};

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  borrador: "#6b7280",
  solicitada: "#60a5fa",
  pendiente: "#fbbf24",
  enviada: "#f97316",
  pagada: "#4ade80",
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  borrador: "Borrador",
  solicitada: "Solicitada",
  pendiente: "Pendiente",
  enviada: "Enviada",
  pagada: "Pagada",
};

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  efectivo: "#4ade80",
  tarjeta: "#60a5fa",
  transferencia: "#b9a8ff",
  bizum: "#f472b6",
  cheque: "#fbbf24",
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  transferencia: "Transferencia",
  bizum: "Bizum",
  cheque: "Cheque",
};

interface InvoiceAnalyticsWidgetProps {
  analytics: InvoiceAnalytics;
  loading?: boolean;
  className?: string;
}

// Custom tooltip for charts
const CustomTooltip = ({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bo-chartTooltip" data-slot="invoiceAnalyticsWidget-chartTooltip">
        <p className="bo-chartTooltipLabel" data-slot="invoiceAnalyticsWidget-chartTooltipLabel">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} data-slot="invoiceAnalyticsWidget-p">
            {entry.name}: {formatter ? formatter(entry.value) : entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function InvoiceAnalyticsWidget({
  analytics,
  loading = false,
  className,
}: InvoiceAnalyticsWidgetProps) {
  // Prepare data for status pie chart
  const statusData = useMemo(() => {
    return analytics.statusDistribution.map((item) => ({
      name: STATUS_LABELS[item.status as InvoiceStatus] || item.status,
      value: item.count,
      amount: item.amount,
      color: STATUS_COLORS[item.status as InvoiceStatus] || COLORS.muted,
    }));
  }, [analytics.statusDistribution]);

  // Prepare data for payment method pie chart
  const paymentData = useMemo(() => {
    return analytics.paymentMethodDistribution.map((item) => ({
      name: PAYMENT_METHOD_LABELS[item.method as PaymentMethod] || item.method,
      value: item.count,
      amount: item.amount,
      color: PAYMENT_METHOD_COLORS[item.method as PaymentMethod] || COLORS.muted,
    }));
  }, [analytics.paymentMethodDistribution]);

  // Prepare data for revenue bar chart
  const revenueData = useMemo(() => {
    return analytics.monthlyRevenue.map((item) => ({
      month: item.monthLabel,
      revenue: item.revenue,
      count: item.invoiceCount,
    }));
  }, [analytics.monthlyRevenue]);

  // Prepare data for average value trend
  const averageValueData = useMemo(() => {
    return analytics.averageValueTrend.map((item) => ({
      month: item.monthLabel,
      average: item.averageValue,
      count: item.invoiceCount,
    }));
  }, [analytics.averageValueTrend]);

  if (loading) {
    return (
      <div className="bo-analyticsLoading" data-slot="invoiceAnalyticsWidget-analyticsLoading">
        <div className="bo-skeleton" style={{ height: "300px", width: "100%" }} / data-slot="invoiceAnalyticsWidget-skeleton">
      </div>
    );
  }

  const formatCurrency = (value: number) => `${value.toLocaleString()} €`;

  return (
    <div className={cn("bo-invoiceAnalytics", className)} data-slot="invoiceAnalyticsWidget-div">
      {/* Summary Cards */}
      <div className="bo-analyticsSummary" data-slot="invoiceAnalyticsWidget-analyticsSummary">
        <div className="bo-analyticsSummaryCard" data-slot="invoiceAnalyticsWidget-analyticsSummaryCard">
          <div className="bo-analyticsSummaryLabel" data-slot="invoiceAnalyticsWidget-analyticsSummaryLabel">Ingresos Totales</div>
          <div className="bo-analyticsSummaryValue" data-slot="invoiceAnalyticsWidget-analyticsSummaryValue">
            {formatCurrency(analytics.summary.totalRevenue)}
          </div>
        </div>
        <div className="bo-analyticsSummaryCard" data-slot="invoiceAnalyticsWidget-analyticsSummaryCard">
          <div className="bo-analyticsSummaryLabel" data-slot="invoiceAnalyticsWidget-analyticsSummaryLabel">Total Facturas</div>
          <div className="bo-analyticsSummaryValue" data-slot="invoiceAnalyticsWidget-analyticsSummaryValue">
            {analytics.summary.totalInvoices.toLocaleString()}
          </div>
        </div>
        <div className="bo-analyticsSummaryCard" data-slot="invoiceAnalyticsWidget-analyticsSummaryCard">
          <div className="bo-analyticsSummaryLabel" data-slot="invoiceAnalyticsWidget-analyticsSummaryLabel">Valor Medio</div>
          <div className="bo-analyticsSummaryValue" data-slot="invoiceAnalyticsWidget-analyticsSummaryValue">
            {formatCurrency(analytics.summary.averageInvoiceValue)}
          </div>
        </div>
        <div className="bo-analyticsSummaryCard" data-slot="invoiceAnalyticsWidget-analyticsSummaryCard">
          <div className="bo-analyticsSummaryLabel" data-slot="invoiceAnalyticsWidget-analyticsSummaryLabel">Pagadas</div>
          <div className="bo-analyticsSummaryValue bo-analyticsSummaryValue--success" data-slot="invoiceAnalyticsWidget-analyticsSummaryValue--success">
            {analytics.summary.paidInvoices}
          </div>
        </div>
        <div className="bo-analyticsSummaryCard" data-slot="invoiceAnalyticsWidget-analyticsSummaryCard">
          <div className="bo-analyticsSummaryLabel" data-slot="invoiceAnalyticsWidget-analyticsSummaryLabel">Pendientes</div>
          <div className="bo-analyticsSummaryValue bo-analyticsSummaryValue--warning" data-slot="invoiceAnalyticsWidget-analyticsSummaryValue--warning">
            {analytics.summary.pendingInvoices}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="bo-analyticsCharts" data-slot="invoiceAnalyticsWidget-analyticsCharts">
        {/* Revenue by Month Chart */}
        <div className="bo-analyticsChart bo-analyticsChart--wide" data-slot="invoiceAnalyticsWidget-analyticsChart--wide">
          <h3 className="bo-analyticsChartTitle" data-slot="invoiceAnalyticsWidget-analyticsChartTitle">Ingresos por Mes</h3>
          <div className="bo-analyticsChartContainer" data-slot="invoiceAnalyticsWidget-analyticsChartContainer">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--bo-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--bo-border)" }}
                />
                <YAxis
                  tick={{ fill: "var(--bo-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--bo-border)" }}
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k €`}
                />
                <Tooltip
                  content={<CustomTooltip formatter={formatCurrency} />}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                />
                <Bar dataKey="revenue" name="Ingresos" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Invoice Count by Status Pie Chart */}
        <div className="bo-analyticsChart" data-slot="invoiceAnalyticsWidget-analyticsChart">
          <h3 className="bo-analyticsChartTitle" data-slot="invoiceAnalyticsWidget-analyticsChartTitle">Facturas por Estado</h3>
          <div className="bo-analyticsChartContainer" data-slot="invoiceAnalyticsWidget-analyticsChartContainer">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: "var(--bo-muted)" }}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bo-chartTooltip" data-slot="invoiceAnalyticsWidget-chartTooltip">
                          <p className="bo-chartTooltipLabel" data-slot="invoiceAnalyticsWidget-chartTooltipLabel">{data.name}</p>
                          <p data-slot="invoiceAnalyticsWidget-lue">Cantidad: {data.value}</p>
                          <p data-slot="invoiceAnalyticsWidget-unt">Importe: {formatCurrency(data.amount)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Customers by Revenue */}
        <div className="bo-analyticsChart" data-slot="invoiceAnalyticsWidget-analyticsChart">
          <h3 className="bo-analyticsChartTitle" data-slot="invoiceAnalyticsWidget-analyticsChartTitle">Top Clientes por Ingresos</h3>
          <div className="bo-analyticsChartContainer bo-analyticsTableContainer" data-slot="invoiceAnalyticsWidget-analyticsTableContainer">
            {analytics.topCustomers.length > 0 ? (
              <table className="bo-analyticsTable" data-slot="analytics-table">
                <thead data-slot="analytics-thead">
                  <tr data-slot="analytics-table-row">
                    <th data-slot="analytics-table-header">Cliente</th>
                    <th data-slot="analytics-table-header">Facturas</th>
                    <th data-slot="analytics-table-header">Ingresos</th>
                  </tr>
                </thead>
                <tbody data-slot="analytics-tbody">
                  {analytics.topCustomers.slice(0, 10).map((customer, index) => (
                    <tr key={index} data-slot={`analytics-table-row-${index}`}>
                      <td data-slot="analytics-table-cell">
                        <div className="bo-analyticsCustomerName" data-slot="invoiceAnalyticsWidget-analyticsCustomerName">{customer.customerName}</div>
                        <div className="bo-analyticsCustomerEmail" data-slot="invoiceAnalyticsWidget-analyticsCustomerEmail">{customer.customerEmail}</div>
                      </td>
                      <td data-slot="analytics-table-cell">{customer.invoiceCount}</td>
                      <td className="bo-analyticsRevenue" data-slot="analytics-table-cell">{formatCurrency(customer.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="bo-analyticsEmpty" data-slot="invoiceAnalyticsWidget-analyticsEmpty">No hay datos de clientes</div>
            )}
          </div>
        </div>

        {/* Average Invoice Value Trend */}
        <div className="bo-analyticsChart bo-analyticsChart--wide" data-slot="invoiceAnalyticsWidget-analyticsChart--wide">
          <h3 className="bo-analyticsChartTitle" data-slot="invoiceAnalyticsWidget-analyticsChartTitle">Tendencia Valor Medio</h3>
          <div className="bo-analyticsChartContainer" data-slot="invoiceAnalyticsWidget-analyticsChartContainer">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={averageValueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--bo-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--bo-border)" }}
                />
                <YAxis
                  tick={{ fill: "var(--bo-muted)", fontSize: 12 }}
                  axisLine={{ stroke: "var(--bo-border)" }}
                  tickFormatter={(value) => `${value} €`}
                />
                <Tooltip content={<CustomTooltip formatter={formatCurrency} />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="average"
                  name="Valor Medio"
                  stroke={COLORS.secondary}
                  strokeWidth={2}
                  dot={{ fill: COLORS.secondary, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: COLORS.secondary }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="bo-analyticsChart" data-slot="invoiceAnalyticsWidget-analyticsChart">
          <h3 className="bo-analyticsChartTitle" data-slot="invoiceAnalyticsWidget-analyticsChartTitle">Metodos de Pago</h3>
          <div className="bo-analyticsChartContainer" data-slot="invoiceAnalyticsWidget-analyticsChartContainer">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={paymentData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                  labelLine={{ stroke: "var(--bo-muted)" }}
                >
                  {paymentData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bo-chartTooltip" data-slot="invoiceAnalyticsWidget-chartTooltip">
                          <p className="bo-chartTooltipLabel" data-slot="invoiceAnalyticsWidget-chartTooltipLabel">{data.name}</p>
                          <p data-slot="invoiceAnalyticsWidget-lue">Cantidad: {data.value}</p>
                          <p data-slot="invoiceAnalyticsWidget-unt">Importe: {formatCurrency(data.amount)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InvoiceAnalyticsWidget;
