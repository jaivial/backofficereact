import React, { useMemo } from "react";
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
      <div className="absolute z-10 px-3 py-2 rounded-lg border border-white/[0.06] bg-bo-surface shadow-lg pointer-events-none">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-xs">
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
      <div className="flex items-center justify-center p-8">
        <div className="w-full h-[300px] rounded-lg bg-white/[0.02] animate-pulse" />
      </div>
    );
  }

  const formatCurrency = (value: number) => `${value.toLocaleString()} €`;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-xs text-muted-foreground mb-1">Ingresos Totales</div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(analytics.summary.totalRevenue)}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Facturas</div>
          <div className="text-xl font-bold text-foreground">
            {analytics.summary.totalInvoices.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-xs text-muted-foreground mb-1">Valor Medio</div>
          <div className="text-xl font-bold text-foreground">
            {formatCurrency(analytics.summary.averageInvoiceValue)}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-xs text-muted-foreground mb-1">Pagadas</div>
          <div className="text-xl font-bold text-green-400">
            {analytics.summary.paidInvoices}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="text-xs text-muted-foreground mb-1">Pendientes</div>
          <div className="text-xl font-bold text-yellow-400">
            {analytics.summary.pendingInvoices}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month Chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-4">Ingresos por Mes</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(238, 240, 246, 0.64)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
                />
                <YAxis
                  tick={{ fill: "rgba(238, 240, 246, 0.64)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
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
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-4">Facturas por Estado</h3>
          <div className="h-[280px]">
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
                  labelLine={{ stroke: "rgba(238, 240, 246, 0.64)" }}
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
                        <div className="absolute z-10 px-3 py-2 rounded-lg border border-white/[0.06] bg-bo-surface shadow-lg">
                          <p className="text-xs font-semibold text-foreground">{data.name}</p>
                          <p>Cantidad: {data.value}</p>
                          <p>Importe: {formatCurrency(data.amount)}</p>
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
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-4">Top Clientes por Ingresos</h3>
          <div className="overflow-auto h-[280px]">
            {analytics.topCustomers.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Facturas</th>
                    <th>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topCustomers.slice(0, 10).map((customer, index) => (
                    <tr key={index}>
                      <td>
                        <div className="font-medium">{customer.customerName}</div>
                        <div className="text-xs text-muted-foreground">{customer.customerEmail}</div>
                      </td>
                      <td>{customer.invoiceCount}</td>
                      <td className="font-semibold text-green-400">{formatCurrency(customer.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">No hay datos de clientes</div>
            )}
          </div>
        </div>

        {/* Average Invoice Value Trend */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-4">Tendencia Valor Medio</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={averageValueData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.06)" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(238, 240, 246, 0.64)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
                />
                <YAxis
                  tick={{ fill: "rgba(238, 240, 246, 0.64)", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.06)" }}
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
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold mb-4">Metodos de Pago</h3>
          <div className="h-[280px]">
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
                  labelLine={{ stroke: "rgba(238, 240, 246, 0.64)" }}
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
                        <div className="absolute z-10 px-3 py-2 rounded-lg border border-white/[0.06] bg-bo-surface shadow-lg">
                          <p className="text-xs font-semibold text-foreground">{data.name}</p>
                          <p>Cantidad: {data.value}</p>
                          <p>Importe: {formatCurrency(data.amount)}</p>
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
