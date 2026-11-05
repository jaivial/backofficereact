import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, Percent, PieChart as PieChartIcon, Receipt, TrendingUp, Wallet, WalletCards, type LucideIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { createClient } from "../../../../../api/client";
import type { ManualBillingPayload } from "../../../../../api/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../../../ui/shadcn/chart";
import { Card } from "../../../../../ui/shell/Card";
import {
  BUCKET_LABELS,
  DELTA_COLORS,
  PERIOD_PRESETS,
  WEEKDAY_LABELS,
  bucketLabel,
  deltaTone,
  formatISODate,
  formatNumber,
  formatPercent,
  periodRange,
  percentDelta,
  type PeriodKey,
} from "../AffluenceDashboard/affluenceUtils";
import { AffluencePanel, ChartEmpty, ToggleChip } from "../AffluenceDashboard/affluenceWidgets";

const LineChartPrimitive = LineChart as React.ComponentType<any>;
const LinePrimitive = Line as React.ComponentType<any>;
const BarChartPrimitive = BarChart as React.ComponentType<any>;
const BarPrimitive = Bar as React.ComponentType<any>;
const CartesianGridPrimitive = CartesianGrid as React.ComponentType<any>;
const XAxisPrimitive = XAxis as React.ComponentType<any>;
const YAxisPrimitive = YAxis as React.ComponentType<any>;

const EUR_FORMATTER = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "N/D" : EUR_FORMATTER.format(value);
}

function grossTone(value: number): string {
  return value < 0 ? "text-[var(--bo-on-surface-danger)]" : "text-[var(--bo-text)]";
}

// Local KPI card instead of AffluenceKpi: that widget renders DeltaBadge, which
// pulls lucide icons not present in the existing AnalyticsDashboard test mock.
function BillingKpi({
  label,
  value,
  detail,
  delta,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  delta: number | null;
  icon: LucideIcon;
  testId: string;
}) {
  const tone = deltaTone(delta);
  return (
    <Card variant="glass" className="flex h-full flex-col justify-between" style={{ minHeight: 132 }} data-testid={testId} data-ui={`${testId}-card`}>
      <div className="flex items-start justify-between gap-3" data-ui={`${testId}-head`}>
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]" data-ui={`${testId}-label`}>{label}</span>
        <span className="rounded-lg bg-[var(--bo-bg-selected)] p-2 text-[var(--bo-accent)]" aria-hidden="true" data-ui={`${testId}-icon-wrap`}>
          <Icon size={16} data-ui={`${testId}-icon`} />
        </span>
      </div>
      <div data-ui={`${testId}-body`}>
        <div className="mt-2 text-xl font-semibold tracking-tight sm:mt-3 sm:text-2xl" data-testid={`${testId}-value`} data-ui={`${testId}-value`}>{value}</div>
        <p className="mt-1 text-xs leading-5 text-[var(--bo-muted)]" data-ui={`${testId}-detail`}>{detail}</p>
        <p className="mt-2 text-xs font-medium" style={{ color: DELTA_COLORS[tone] }} data-testid={`${testId}-delta`} data-ui={`${testId}-delta`}>
          {delta === null || delta === undefined || !Number.isFinite(delta) ? "Sin periodo anterior" : `${formatPercent(delta)} vs periodo anterior`}
        </p>
      </div>
    </Card>
  );
}

function BillingDeltaLine({ delta, testId }: { delta: number | null; testId: string }) {
  const tone = deltaTone(delta);
  const hasValue = delta !== null && Number.isFinite(delta);
  return (
    <p className="text-sm font-semibold" style={{ color: DELTA_COLORS[tone] }} data-testid={testId} data-ui={`${testId}-line`}>
      {hasValue ? `${formatPercent(delta as number)} frente al periodo anterior de igual duración` : "Sin periodo anterior con el que comparar"}
    </p>
  );
}

export type ManualBillingSectionProps = React.HTMLAttributes<HTMLElement> & {
  /** Bumped by the parent after a new entry so the ledger refetches. */
  refreshKey?: number;
};

/**
 * Manual billing ledger rendered with the same period presets and section
 * layout as the booking (affluence) statistics: KPIs, evolution, distribution
 * by bucket and by weekday, plus the VAT split and the period entries.
 * Coordination id: manual_billing_stats_v1.
 */
export function ManualBillingSection({ refreshKey = 0, className, ...props }: ManualBillingSectionProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [period, setPeriod] = useState<PeriodKey>("1y");
  const preset = useMemo(() => PERIOD_PRESETS.find((entry) => entry.id === period) ?? PERIOD_PRESETS[4], [period]);
  const range = useMemo(() => periodRange(preset), [preset]);
  const bucket = preset.bucket;

  const [data, setData] = useState<ManualBillingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.analytics
      .getManualBilling({ from: range.from, to: range.to, bucket })
      .then((response) => {
        if (!active) return;
        if (!response.success) {
          setData(null);
          setError(response.message);
          return;
        }
        setData(response);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Error cargando la facturación");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api.analytics, bucket, range.from, range.to, refreshKey]);

  const seriesData = useMemo(
    () =>
      (data?.series ?? []).map((point) => ({
        label: bucketLabel(point.key, bucket),
        gross: point.grossEUR,
        net: point.netEUR,
      })),
    [data, bucket],
  );

  const weekdayData = useMemo(
    () =>
      (data?.weekday ?? []).slice(0, 7).map((point, index) => ({
        day: WEEKDAY_LABELS[Math.max(0, Math.min(6, point.weekday - 1))] ?? WEEKDAY_LABELS[index],
        gross: point.grossEUR,
        vat: point.vatEUR,
      })),
    [data],
  );

  const totals = data?.totals ?? null;
  const previous = data?.previous ?? null;
  const hasData = Boolean(totals && totals.entries !== 0);
  const hasVat = Boolean(data?.vatBreakdown?.some((row) => row.rate > 0 && row.vatEUR !== 0));
  const periodDelta = percentDelta(totals?.grossEUR ?? 0, previous?.grossEUR ?? 0);

  return (
    <section
      className={["flex flex-col gap-4 sm:gap-5", className].filter(Boolean).join(" ")}
      data-testid="manual-billing-section"
      data-ui="manual-billing-section"
      {...props}
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-ui="manual-billing-header">
        <div className="min-w-0" data-ui="manual-billing-heading">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bo-accent-2)]" data-ui="manual-billing-eyebrow">
            Facturación
          </p>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="manual-billing-title" data-ui="manual-billing-title">
            Facturación manual
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--bo-muted)] sm:mt-2" data-ui="manual-billing-description">
            Datos simples de facturación introducidos a mano, con base neta e IVA separados. Un importe negativo resta.
          </p>
          <p className="mt-1 text-xs text-[var(--bo-faint)]" data-testid="manual-billing-history" data-ui="manual-billing-history">
            {data?.history?.firstDate
              ? `Registros disponibles: ${formatISODate(data.history.firstDate)} — ${formatISODate(data.history.lastDate ?? data.history.firstDate)}`
              : "Sin registros de facturación manual todavía."}
          </p>
        </div>
        <div className="flex flex-col gap-2" data-ui="manual-billing-period">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]" data-ui="manual-billing-period-label">
            Periodo
          </span>
          <div className="flex flex-wrap gap-2" data-testid="manual-billing-period-chips" data-ui="manual-billing-period-chips">
            {PERIOD_PRESETS.map((entry) => (
              <ToggleChip
                key={`manual-billing-period-${entry.id}`}
                label={entry.label}
                active={entry.id === period}
                onClick={() => setPeriod(entry.id)}
                testId={`manual-billing-period-${entry.id}`}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--bo-muted)]" data-testid="manual-billing-period-range" data-ui="manual-billing-period-range">
            {formatISODate(range.from)} — {formatISODate(range.to)} · agrupado por {BUCKET_LABELS[bucket]}
          </span>
        </div>
      </header>

      {error ? (
        <Card variant="glass" className="border-[var(--bo-on-surface-danger)]" data-testid="manual-billing-error" data-ui="manual-billing-error">
          <p className="text-sm text-[var(--bo-on-surface-danger)]" data-ui="manual-billing-error-text">
            {error}
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-5 xl:grid-cols-4" data-testid="manual-billing-kpis" data-ui="manual-billing-kpis" data-loading={loading}>
        <BillingKpi label="Facturado" value={formatCurrency(totals?.grossEUR)} detail="Importe total registrado en el periodo" delta={data?.deltaPercent?.grossEUR ?? null} icon={Wallet} testId="manual-billing-kpi-gross" />
        <BillingKpi label="Base neta" value={formatCurrency(totals?.netEUR)} detail="Lo facturado sin IVA" delta={data?.deltaPercent?.netEUR ?? null} icon={Receipt} testId="manual-billing-kpi-net" />
        <BillingKpi
          label="IVA repercutido"
          value={formatCurrency(totals?.vatEUR)}
          detail={`${formatNumber(totals?.vatIncludedEntries ?? 0)} de ${formatNumber(totals?.entries ?? 0)} registros con IVA`}
          delta={data?.deltaPercent?.vatEUR ?? null}
          icon={Percent}
          testId="manual-billing-kpi-vat"
        />
        <BillingKpi
          label="Ticket medio"
          value={formatCurrency(totals?.avgGrossEUR)}
          detail={`${formatNumber(totals?.entries ?? 0)} registros en ${formatNumber(totals?.activeDays ?? 0)} días`}
          delta={previous && previous.avgGrossEUR > 0 ? percentDelta(totals?.avgGrossEUR, previous.avgGrossEUR) : null}
          icon={WalletCards}
          testId="manual-billing-kpi-average"
        />
      </div>

      <AffluencePanel
        title="Evolución de la facturación"
        description="Importe registrado (con IVA) y base neta del periodo frente al periodo anterior de igual duración."
        icon={TrendingUp}
        testId="manual-billing-trend-panel"
      >
        <div className="flex flex-col gap-4" data-ui="manual-billing-trend-body">
          <BillingDeltaLine delta={periodDelta} testId="manual-billing-period-delta" />
          {hasData && seriesData.length > 0 ? (
            <ChartContainer className="h-64 min-h-56 sm:h-80 sm:min-h-64" config={{}} id="manual-billing-trend" data-testid="manual-billing-trend-chart">
              <LineChartPrimitive data={seriesData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <LinePrimitive dataKey="gross" name="Facturado" type="monotone" stroke="var(--bo-accent)" strokeWidth={2} dot={false} />
                <LinePrimitive dataKey="net" name="Base neta" type="monotone" stroke="var(--bo-accent-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="manual-billing-trend-empty" message="Sin facturación manual en el periodo seleccionado." />
          )}
        </div>
      </AffluencePanel>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2" data-ui="manual-billing-bars-row">
        <AffluencePanel
          title="Facturación por periodo"
          description={`Reparto del importe en bloques de ${BUCKET_LABELS[bucket]}.`}
          icon={BarChart3}
          testId="manual-billing-bucket-panel"
        >
          {hasData ? (
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={{}} id="manual-billing-bucket" data-testid="manual-billing-bucket-chart">
              <BarChartPrimitive data={seriesData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <BarPrimitive dataKey="gross" name="Facturado" fill="var(--bo-accent)" radius={[3, 3, 0, 0]} />
              </BarChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="manual-billing-bucket-empty" message="Sin datos para representar." />
          )}
        </AffluencePanel>

        <AffluencePanel
          title="Facturación por día de la semana"
          description="Días con más importe registrado en el periodo elegido."
          icon={PieChartIcon}
          testId="manual-billing-weekday-panel"
        >
          {hasData ? (
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={{}} id="manual-billing-weekday" data-testid="manual-billing-weekday-chart">
              <BarChartPrimitive data={weekdayData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <BarPrimitive dataKey="gross" name="Facturado" fill="var(--bo-accent-2)" radius={[3, 3, 0, 0]} />
              </BarChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="manual-billing-weekday-empty" message="Sin datos por día de la semana." />
          )}
        </AffluencePanel>
      </div>

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-2" data-ui="manual-billing-detail-row">
        <AffluencePanel
          title="Desglose de IVA"
          description="Lo pagado frente a la base neta y el IVA restado de cada tipo."
          icon={Percent}
          testId="manual-billing-vat-panel"
        >
          {data?.vatBreakdown?.length ? (
            <div className="overflow-x-auto" data-ui="manual-billing-vat-table-wrap">
              <table className="w-full text-left text-sm" data-testid="manual-billing-vat-table">
                <thead className="border-b border-[var(--bo-border)] text-xs uppercase tracking-wide text-[var(--bo-muted)]">
                  <tr>
                    <th className="pb-3 pr-3 font-medium">Tipo</th>
                    <th className="pb-3 pr-3 font-medium text-right">Registros</th>
                    <th className="pb-3 pr-3 font-medium text-right">Con IVA</th>
                    <th className="pb-3 pr-3 font-medium text-right">Base neta</th>
                    <th className="pb-3 font-medium text-right">IVA restado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.vatBreakdown.map((row) => (
                    <tr className="border-b border-[var(--bo-border)] last:border-0" key={`manual-billing-vat-${row.rate}`} data-testid={`manual-billing-vat-row-${row.rate}`}>
                      <td className="py-2.5 pr-3 font-medium">{row.rate > 0 ? `${formatNumber(row.rate)} %` : "Sin IVA (0 %)"}</td>
                      <td className="py-2.5 pr-3 text-right text-[var(--bo-muted)]">{formatNumber(row.entries)}</td>
                      <td className={`py-2.5 pr-3 text-right ${grossTone(row.grossEUR)}`}>{formatCurrency(row.grossEUR)}</td>
                      <td className="py-2.5 pr-3 text-right">{formatCurrency(row.netEUR)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(row.vatEUR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!hasVat ? (
                <p className="mt-3 text-xs leading-5 text-[var(--bo-muted)]" data-testid="manual-billing-vat-note">
                  Todos los registros del periodo se introdujeron sin IVA (0 %).
                </p>
              ) : null}
            </div>
          ) : (
            <ChartEmpty testId="manual-billing-vat-empty" message="Sin IVA que desglosar en el periodo." />
          )}
        </AffluencePanel>

        <AffluencePanel
          title="Registros del periodo"
          description={data?.entriesTruncated
            ? `Los últimos ${formatNumber(data.entries.length)} registros incluidos en los totales, con su base neta e IVA (hay más en el periodo).`
            : "Los últimos registros incluidos en los totales, con su base neta e IVA."}
          icon={Receipt}
          testId="manual-billing-entries-panel"
        >
          {data?.entries?.length ? (
            <div className="max-h-72 overflow-y-auto" data-ui="manual-billing-entries-list">
              <table className="w-full text-left text-sm" data-testid="manual-billing-entries-table">
                <thead className="sticky top-0 border-b border-[var(--bo-border)] bg-[var(--bo-surface)] text-xs uppercase tracking-wide text-[var(--bo-muted)]">
                  <tr>
                    <th className="pb-3 pr-3 font-medium">Fecha</th>
                    <th className="pb-3 pr-3 font-medium text-right">Importe</th>
                    <th className="pb-3 pr-3 font-medium text-right">IVA</th>
                    <th className="pb-3 pr-3 font-medium text-right">Base</th>
                    <th className="pb-3 font-medium text-right">Cuota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry) => (
                    <tr className="border-b border-[var(--bo-border)] last:border-0" key={`manual-billing-entry-${entry.id}`} data-testid={`manual-billing-entry-${entry.id}`}>
                      <td className="py-2.5 pr-3 font-medium">{formatISODate(entry.date)}</td>
                      <td className={`py-2.5 pr-3 text-right font-medium ${grossTone(entry.grossEUR)}`}>{formatCurrency(entry.grossEUR)}</td>
                      <td className="py-2.5 pr-3 text-right text-[var(--bo-muted)]">{formatNumber(entry.vatRate)} %</td>
                      <td className="py-2.5 pr-3 text-right">{formatCurrency(entry.netEUR)}</td>
                      <td className="py-2.5 text-right">{formatCurrency(entry.vatEUR)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ChartEmpty testId="manual-billing-entries-empty" message="Todavía no hay facturación manual en este periodo." />
          )}
        </AffluencePanel>
      </div>

      <footer className="flex items-center gap-2 text-xs text-[var(--bo-faint)]" data-ui="manual-billing-footer">
        <Wallet size={13} aria-hidden="true" data-ui="manual-billing-footer-icon" />
        <span data-ui="manual-billing-footer-text">
          Fuente: facturación manual · comparativa anterior: {previous ? `${formatISODate(previous.from)} — ${formatISODate(previous.to)}` : "n/d"}
        </span>
      </footer>
    </section>
  );
}
