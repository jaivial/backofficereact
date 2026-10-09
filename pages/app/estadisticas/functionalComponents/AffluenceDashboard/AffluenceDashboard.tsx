import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarCheck, CalendarDays, CalendarRange, History, LineChart as LineChartIcon, Users, Utensils } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { createClient } from "../../../../../api/client";
import type {
  AffluenceBucket,
  AffluencePayload,
  AffluenceSeasonalPayload,
} from "../../../../../api/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../../../ui/shadcn/chart";
import { Card } from "../../../../../ui/shell/Card";
import {
  BUCKET_LABELS,
  PERIOD_PRESETS,
  WEEKDAY_LABELS,
  bucketLabel,
  defaultSeasonMonths,
  formatISODate,
  formatNumber,
  hasAffluenceData,
  monthName,
  percentDelta,
  periodRange,
  type PeriodKey,
} from "./affluenceUtils";
import { AffluenceKpi, AffluencePanel, ChartEmpty, PeriodDeltaBanner, ToggleChip } from "./affluenceWidgets";
import { MonthSeasonPanel, SeasonPanel } from "./SeasonalityPanels";

const LineChartPrimitive = LineChart as React.ComponentType<any>;
const LinePrimitive = Line as React.ComponentType<any>;
const BarChartPrimitive = BarChart as React.ComponentType<any>;
const BarPrimitive = Bar as React.ComponentType<any>;
const CartesianGridPrimitive = CartesianGrid as React.ComponentType<any>;
const XAxisPrimitive = XAxis as React.ComponentType<any>;
const YAxisPrimitive = YAxis as React.ComponentType<any>;

const LINE_CONFIG = { covers: { label: "Comensales", color: "" } };
const BAR_CONFIG = { covers: { label: "Comensales", color: "" } };

/** Fetches one seasonal view; keeps the two seasonal sections independent. */
function useSeasonal(months: number[]) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [data, setData] = useState<AffluenceSeasonalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthKey = months.join(",");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.analytics
      .getAffluenceSeasonal(months)
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
        setError(loadError instanceof Error ? loadError.message : "Error cargando comparativa");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // months is compared by its serialized value so callers can pass a fresh array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey, api.analytics]);

  return { data, loading, error };
}

export type AffluenceDashboardProps = React.HTMLAttributes<HTMLElement> & {
  /** Injected in tests/stories; otherwise the browser client is used. */
  initialPeriod?: PeriodKey;
};

export function AffluenceDashboard({ initialPeriod = "1y", className, ...props }: AffluenceDashboardProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const preset = useMemo(() => PERIOD_PRESETS.find((entry) => entry.id === period) ?? PERIOD_PRESETS[4], [period]);
  const range = useMemo(() => periodRange(preset), [preset]);
  const bucket: AffluenceBucket = preset.bucket;

  const [data, setData] = useState<AffluencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [compareMonth, setCompareMonth] = useState(() => new Date().getMonth() + 1);
  const [seasonMonths, setSeasonMonths] = useState<number[]>(() => defaultSeasonMonths());

  const monthSeason = useSeasonal([compareMonth]);
  const seasonSet = useSeasonal(seasonMonths);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.analytics
      .getAffluence({ from: range.from, to: range.to, bucket })
      .then((response) => {
        if (!response.success) {
          setData(null);
          setError(response.message);
          return;
        }
        setData(response);
      })
      .catch((loadError: unknown) => {
        setData(null);
        setError(loadError instanceof Error ? loadError.message : "Error cargando afluencia");
      })
      .finally(() => setLoading(false));
  }, [api.analytics, range.from, range.to, bucket]);

  useEffect(() => {
    load();
  }, [load]);

  const seriesData = useMemo(
    () =>
      (data?.series ?? []).map((point) => ({
        label: bucketLabel(point.key, bucket),
        covers: point.covers,
        bookings: point.bookings,
      })),
    [data, bucket],
  );

  const weekdayData = useMemo(
    () =>
      (data?.weekday ?? []).slice(0, 7).map((point, index) => ({
        day: WEEKDAY_LABELS[Math.max(0, Math.min(6, point.weekday - 1))] ?? WEEKDAY_LABELS[index],
        covers: point.covers,
        bookings: point.bookings,
      })),
    [data],
  );

  const totals = data?.totals ?? null;
  const previous = data?.previous ?? null;
  const hasData = hasAffluenceData(totals);
  const history = data?.history ?? null;

  return (
    <section
      className={["mx-auto flex w-full max-w-screen-2xl flex-col gap-5 px-4 pb-4 text-[var(--bo-text)] sm:px-6 sm:pb-6 xl:px-8 xl:pb-8", className].filter(Boolean).join(" ")}
      data-ui="affluence-dashboard"
      data-testid="affluence-dashboard"
      {...props}
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-ui="affluence-dashboard-header">
        <div className="min-w-0" data-ui="affluence-dashboard-heading">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bo-accent-2)]" data-ui="affluence-dashboard-eyebrow">
            Afluencia de clientes
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="affluence-dashboard-title" data-ui="affluence-dashboard-title">
            Comensales y reservas
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--bo-muted)]" data-ui="affluence-dashboard-description">
            Evolución de la afluencia de clientes sobre el histórico completo de reservas, con comparativas por temporada.
          </p>
          <p className="mt-1 text-xs text-[var(--bo-faint)]" data-testid="affluence-history-bounds" data-ui="affluence-history-bounds">
            {history?.firstDate
              ? `Histórico disponible: ${formatISODate(history.firstDate)} — ${formatISODate(history.lastDate ?? history.firstDate)}`
              : "Sin histórico de reservas todavía."}
          </p>
        </div>
        <div className="flex flex-col gap-2" data-ui="affluence-dashboard-period">
          <span className="text-xs font-medium uppercase tracking-wide text-[var(--bo-muted)]" data-ui="affluence-period-label">
            Periodo
          </span>
          <div className="flex flex-wrap gap-2" data-testid="affluence-period-chips" data-ui="affluence-period-chips">
            {PERIOD_PRESETS.map((entry) => (
              <ToggleChip
                key={`period-${entry.id}`}
                label={entry.label}
                active={entry.id === period}
                onClick={() => setPeriod(entry.id)}
                testId={`affluence-period-${entry.id}`}
              />
            ))}
          </div>
          <span className="text-xs text-[var(--bo-muted)]" data-testid="affluence-period-range" data-ui="affluence-period-range">
            {formatISODate(range.from)} — {formatISODate(range.to)} · agrupado por {BUCKET_LABELS[bucket]}
          </span>
        </div>
      </header>

      {error ? (
        <Card variant="glass" className="border-[var(--bo-on-surface-danger)]" data-testid="affluence-error" data-ui="affluence-error">
          <p className="text-sm text-[var(--bo-on-surface-danger)]" data-ui="affluence-error-text">
            {error}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" data-testid="affluence-kpis" data-ui="affluence-kpis" data-loading={loading}>
        <AffluenceKpi
          label="Comensales"
          value={formatNumber(totals?.covers ?? 0)}
          detail="Suma de comensales reservados en el periodo"
          delta={data?.deltaPercent.covers ?? null}
          icon={Users}
          testId="affluence-kpi-covers"
        />
        <AffluenceKpi
          label="Reservas"
          value={formatNumber(totals?.bookings ?? 0)}
          detail="Número de reservas cerradas en el periodo"
          delta={data?.deltaPercent.bookings ?? null}
          icon={CalendarCheck}
          testId="affluence-kpi-bookings"
        />
        <AffluenceKpi
          label="Media por reserva"
          value={formatNumber(totals?.avgPartySize ?? 0)}
          detail="Comensales medios por reserva"
          delta={percentDelta(totals?.avgPartySize, previous?.avgPartySize)}
          icon={Utensils}
          testId="affluence-kpi-party-size"
        />
        <AffluenceKpi
          label="Media diaria"
          value={formatNumber(totals?.avgCoversPerActiveDay ?? 0)}
          detail={`Comensales medios en ${formatNumber(totals?.activeDays ?? 0)} días con reservas`}
          delta={percentDelta(totals?.avgCoversPerActiveDay, previous?.avgCoversPerActiveDay)}
          icon={CalendarRange}
          testId="affluence-kpi-daily"
        />
      </div>

      <AffluencePanel
        title="Evolución de la afluencia"
        description="Comensales del periodo frente al periodo anterior de igual duración."
        icon={LineChartIcon}
        testId="affluence-trend-panel"
      >
        <div className="flex flex-col gap-4" data-ui="affluence-trend-body">
          <PeriodDeltaBanner delta={data?.deltaPercent.covers ?? null} testId="affluence-period-delta" />
          {hasData && seriesData.length > 0 ? (
            <ChartContainer className="h-80 min-h-64" config={LINE_CONFIG} id="affluence-trend" data-testid="affluence-trend-chart">
              <LineChartPrimitive data={seriesData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <LinePrimitive dataKey="covers" name="Comensales" type="monotone" stroke="var(--bo-accent)" strokeWidth={2} dot={false} />
                <LinePrimitive dataKey="bookings" name="Reservas" type="monotone" stroke="var(--bo-accent-2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="affluence-trend-empty" message="Sin reservas en el periodo seleccionado." />
          )}
        </div>
      </AffluencePanel>

      <div className="grid gap-5 lg:grid-cols-2" data-ui="affluence-bars-row">
        <AffluencePanel
          title="Comensales por periodo"
          description={`Reparto del volumen en bloques de ${BUCKET_LABELS[bucket]}.`}
          icon={BarChart3}
          testId="affluence-bucket-panel"
        >
          {hasData ? (
            <ChartContainer className="h-72 min-h-60" config={BAR_CONFIG} id="affluence-bucket" data-testid="affluence-bucket-chart">
              <BarChartPrimitive data={seriesData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} interval="preserveStartEnd" />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <BarPrimitive dataKey="covers" name="Comensales" fill="var(--bo-accent)" radius={[3, 3, 0, 0]} />
              </BarChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="affluence-bucket-empty" message="Sin datos para representar." />
          )}
        </AffluencePanel>

        <AffluencePanel
          title="Comensales por día de la semana"
          description="Días con más concurrencia en el periodo elegido."
          icon={CalendarDays}
          testId="affluence-weekday-panel"
        >
          {hasData ? (
            <ChartContainer className="h-72 min-h-60" config={BAR_CONFIG} id="affluence-weekday" data-testid="affluence-weekday-chart">
              <BarChartPrimitive data={weekdayData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="day" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <BarPrimitive dataKey="covers" name="Comensales" fill="var(--bo-accent-2)" radius={[3, 3, 0, 0]} />
              </BarChartPrimitive>
            </ChartContainer>
          ) : (
            <ChartEmpty testId="affluence-weekday-empty" message="Sin datos por día de la semana." />
          )}
        </AffluencePanel>
      </div>

      <MonthSeasonPanel
        month={compareMonth}
        onMonthChange={setCompareMonth}
        years={monthSeason.data?.years ?? []}
        loading={monthSeason.loading}
        error={monthSeason.error}
        testId="affluence-month-season"
      />

      <SeasonPanel
        months={seasonMonths}
        onMonthsChange={setSeasonMonths}
        years={seasonSet.data?.years ?? []}
        loading={seasonSet.loading}
        error={seasonSet.error}
        testId="affluence-season"
      />

      <footer className="flex items-center gap-2 text-xs text-[var(--bo-faint)]" data-ui="affluence-dashboard-footer">
        <History size={13} aria-hidden="true" data-ui="affluence-footer-icon" />
        <span data-ui="affluence-footer-text">
          Fuente: histórico completo de reservas · comparativa anterior: {previous ? `${formatISODate(previous.from)} — ${formatISODate(previous.to)}` : "n/d"}
        </span>
      </footer>
    </section>
  );
}
