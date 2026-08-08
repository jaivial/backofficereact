import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "../shadcn/chart";

// ---------------------------------------------------------------------------
// Forky report blocks
//
// The assistant emits analytics as a fenced code block tagged `forky-chart`.
// ForkyChart parses that JSON and renders a real Recharts chart, always backed
// by an accessible HTML table so the data is never lost to an SVG.
//
// Series: a single value column ({"label","value"}) renders one series; extra
// numeric columns (e.g. {"label","servidos","reservas"}) render one series per
// column, optionally stacked with `"stacked":true` or an explicit `series`
// array [{key,label,stack}].
// ---------------------------------------------------------------------------

export type ForkyChartType = "bar" | "line" | "area" | "donut";

export interface ForkyChartSeriesSpec {
  key: string;
  label?: string;
  stack?: boolean;
}

export interface ForkyChartSpec {
  title?: string;
  type?: ForkyChartType;
  columns?: string[];
  stacked?: boolean;
  series?: ForkyChartSeriesSpec[];
  data?: Array<Record<string, string | number>>;
}

export interface ForkyChartSeries {
  key: string;
  label: string;
  stack: boolean;
  color: string;
}

export const FORKY_CHART_TYPES = new Set<Readonly<ForkyChartType>>(["bar", "line", "area", "donut"]);

const CHART_PALETTE = [
  "var(--bo-accent, #8b5cf6)",
  "var(--bo-accent-2, #22d3ee)",
  "#f59e0b",
  "#34d399",
  "#f43f5e",
  "#60a5fa",
];

function isForkyChartType(v: unknown): v is ForkyChartType {
  return typeof v === "string" && (FORKY_CHART_TYPES as Set<string>).has(v);
}

/** Safely parse a `forky-chart` fenced block; returns null on malformed/empty. */
export function parseForkyChart(text: string): ForkyChartSpec | null {
  const match = text.match(/```forky-chart\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const raw = JSON.parse(match[1]);
    if (typeof raw !== "object" || raw === null) return null;
    const spec = raw as ForkyChartSpec;
    if (!Array.isArray(spec.data) || spec.data.length === 0) return null;
    const type = isForkyChartType(spec.type) ? spec.type : undefined;
    const title = typeof spec.title === "string" ? spec.title : undefined;
    let series: ForkyChartSeriesSpec[] | undefined;
    if (Array.isArray(spec.series)) {
      series = spec.series
        .filter((s): s is ForkyChartSeriesSpec => typeof s?.key === "string" && s.key.length > 0)
        .map((s) => ({ key: s.key, label: typeof s.label === "string" ? s.label : undefined, stack: s.stack === true }));
    }
    const stacked = spec.stacked === true;
    return { title, type, stacked, series: series?.length ? series : undefined, data: spec.data };
  } catch {
    return null;
  }
}

/** Value key resolved from a row (value/count/amount fallback). */
export function valueKey(row: Record<string, string | number>): string {
  const k = ["value", "count", "amount", "total"];
  for (const key of k) {
    if (key in row && row[key] !== null) return key;
  }
  return Object.keys(row)[1] ?? "value";
}

/** Label key resolved from a row (label/date/day/name fallback). */
export function labelKey(row: Record<string, string | number>): string {
  const k = ["label", "date", "day", "name"];
  for (const key of k) {
    if (row[key] !== undefined) return key;
  }
  return Object.keys(row)[0] ?? "label";
}

/** Resolve the series to plot: explicit `series`, else every numeric column
 * except the label key (single value column yields one series). */
export function chartSeries(spec: ForkyChartSpec): ForkyChartSeries[] {
  const data = spec.data ?? [];
  const colorAt = (i: number) => CHART_PALETTE[i % CHART_PALETTE.length];
  if (spec.series && spec.series.length > 0) {
    return spec.series.map((s, i) => ({
      key: s.key,
      label: s.label ?? s.key,
      stack: s.stack === true || spec.stacked === true,
      color: colorAt(i),
    }));
  }
  if (data.length === 0) return [];
  const first = data[0];
  const lk = labelKey(first);
  const numericKeys = Object.keys(first).filter((k) => k !== lk && typeof first[k] === "number");
  const keys = numericKeys.length > 0 ? numericKeys : [valueKey(first)];
  return keys.map((key, i) => ({ key, label: key, stack: spec.stacked === true, color: colorAt(i) }));
}

/** Build a CSV export from the spec (all series columns, comma-safe quoting). */
export function toCsv(spec: ForkyChartSpec): string {
  const data = spec.data ?? [];
  if (data.length === 0) return "";
  const lk = labelKey(data[0]);
  const series = chartSeries(spec);
  const header = [lk, ...series.map((s) => s.key)];
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.map(escape).join(",")];
  for (const row of data) {
    lines.push(header.map((h) => escape(row[h] ?? "")).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(spec: ForkyChartSpec): void {
  const blob = new Blob([toCsv(spec)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "forky-chart.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Accessible table fallback (also the source of truth for screen readers). */
function AccessibleTable({ spec }: { spec: ForkyChartSpec }) {
  const data = spec.data ?? [];
  const labelVK = data.length ? labelKey(data[0]) : "label";
  const series = chartSeries(spec);
  const cols = [labelVK, ...series.map((s) => s.key)];
  return (
    <table className="w-full border-collapse text-xs" data-testid="forky-chart-table">
      <caption className="sr-only">{spec.title ?? "Gráfico generado por Forky"}</caption>
      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c}
              scope="col"
              className={c === labelVK ? "border border-foreground/10 px-2 py-1 text-left font-medium" : "border border-foreground/10 px-2 py-1 text-right font-medium"}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="even:bg-foreground/[0.03]">
            {cols.map((c) => (
              <td
                key={c}
                className={c === labelVK ? "border border-foreground/10 px-2 py-1" : "border border-foreground/10 px-2 py-1 text-right tabular-nums"}
              >
                {String(row[c] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Explicit empty/loading/error surfaces so the UI never silently drops data. */
function ForkyChartEmpty({ kind, message }: { kind: "empty" | "loading" | "error"; message?: string }) {
  if (kind === "loading") {
    return (
      <div className="rounded-xl border border-foreground/10 p-3" data-testid="forky-chart-loading">
        <div className="h-4 w-1/3 animate-pulse rounded bg-foreground/10" />
        <div className="mt-3 h-40 animate-pulse rounded bg-foreground/5" data-ui="forky-chart-loading-skeleton" />
      </div>
    );
  }
  if (kind === "error") {
    return (
      <div className="rounded-xl border border-destructive/30 p-3 text-xs text-destructive" data-testid="forky-chart-error" role="alert">
        {message ?? "No se pudo dibujar el gráfico"}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-foreground/10 p-3 text-xs text-muted-foreground" data-testid="forky-chart-empty">
      No hay datos suficientes para el gráfico.
    </div>
  );
}

/** Render a Recharts chart for a parsed `forky-chart` spec. */
export function ForkyChartView({ spec }: { spec: ForkyChartSpec }) {
  const data = spec.data ?? [];
  if (data.length === 0) {
    return <ForkyChartEmpty kind="empty" />;
  }
  const labelVK = labelKey(data[0]);
  const series = chartSeries(spec);
  const reducedMotion = useReducedMotion() ?? false;
  const kind = spec.type ?? "bar";

  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  const axisProps = { dataKey: labelVK, tick: { fontSize: 11 } } as const;
  const animation = !reducedMotion;

  let chart: ReactNode;
  if (kind === "donut") {
    const valVK = series[0]?.key ?? valueKey(data[0]);
    chart = (
      <PieChart>
        <Pie
          data={data}
          nameKey={labelVK}
          dataKey={valVK}
          innerRadius={45}
          outerRadius={70}
          paddingAngle={2}
          isAnimationActive={animation}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent nameKey={labelVK} />} />
      </PieChart>
    );
  } else if (kind === "area") {
    chart = (
      <AreaChart data={data}>
        <defs>
          <linearGradient id="forky-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={series[0].color} stopOpacity={0.35} />
            <stop offset="95%" stopColor={series[0].color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border, rgba(148,163,184,0.2))" />
        <XAxis {...axisProps} />
        <YAxis tick={{ fontSize: 11 }} width={34} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            fill={s.key === series[0].key ? "url(#forky-chart-fill)" : s.color}
            fillOpacity={0.12}
            isAnimationActive={animation}
          />
        ))}
      </AreaChart>
    );
  } else if (kind === "line") {
    chart = (
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border, rgba(148,163,184,0.2))" />
        <XAxis {...axisProps} />
        <YAxis tick={{ fontSize: 11 }} width={34} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={animation} />
        ))}
      </LineChart>
    );
  } else {
    chart = (
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border, rgba(148,163,184,0.2))" vertical={false} />
        <XAxis {...axisProps} />
        <YAxis tick={{ fontSize: 11 }} width={34} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color}
            stackId={s.stack ? "stack" : undefined}
            radius={s.stack ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            isAnimationActive={animation}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 p-3" data-testid="forky-chart">
      {spec.title ? (
        <p className="mb-2 text-xs font-semibold text-foreground" data-testid="forky-chart-title">
          {spec.title}
        </p>
      ) : null}
      <ChartContainer config={config} className="h-56" aria-label={spec.title ?? "Gráfico generado por Forky"}>
        {chart}
      </ChartContainer>
      <div className="mt-2 flex items-center gap-2">
        <details className="flex-1" data-testid="forky-chart-details">
          <summary className="cursor-pointer text-[11px] text-muted-foreground">Ver datos</summary>
          <div className="mt-2 overflow-x-auto">
            <AccessibleTable spec={spec} />
          </div>
        </details>
        <button
          type="button"
          onClick={() => downloadCsv(spec)}
          aria-label="Exportar datos a CSV"
          data-testid="forky-chart-csv"
          className="rounded-md border border-foreground/10 px-2 py-1 text-[11px] text-muted-foreground hover:bg-foreground/5"
        >
          CSV
        </button>
      </div>
    </div>
  );
}

/** Remove `forky-chart` fenced blocks so the prose renderer never duplicates the raw JSON. */
export function stripForkyChartBlocks(text: string): string {
  return text.replace(/```forky-chart\s*[\s\S]*?```/g, "");
}

/** Slot: render a Recharts chart when the message contains a `forky-chart` block. */
export function ForkyChart({ text, loading = false, error }: { text: string; loading?: boolean; error?: string }) {
  if (loading) return <ForkyChartEmpty kind="loading" />;
  if (error) return <ForkyChartEmpty kind="error" message={error} />;
  const hasBlock = /```forky-chart/.test(text);
  const spec = parseForkyChart(text);
  if (!spec) return hasBlock ? <ForkyChartEmpty kind="empty" /> : null;
  return <ForkyChartView spec={spec} />;
}
