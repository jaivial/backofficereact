import React, { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { createClient } from "../../../../../api/client";
import type { ManualBillingSeasonalPayload, ManualBillingSeasonalYear } from "../../../../../api/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../../../ui/shadcn/chart";
import {
  DELTA_COLORS,
  MONTH_LABELS,
  deltaTone,
  formatNumber,
  formatPercent,
  monthName,
  yearColor,
} from "../AffluenceDashboard/affluenceUtils";
import { AffluencePanel, ChartEmpty, ToggleChip } from "../AffluenceDashboard/affluenceWidgets";

const BarChartPrimitive = BarChart as React.ComponentType<any>;
const BarPrimitive = Bar as React.ComponentType<any>;
const CartesianGridPrimitive = CartesianGrid as React.ComponentType<any>;
const XAxisPrimitive = XAxis as React.ComponentType<any>;
const YAxisPrimitive = YAxis as React.ComponentType<any>;

const EUR_FORMATTER = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function formatCurrency(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "N/D" : EUR_FORMATTER.format(value);
}

function yearKey(year: ManualBillingSeasonalYear): string {
  return `y${year.year}`;
}

function yearChartConfig(years: ManualBillingSeasonalYear[]): Record<string, { label: string; color: string }> {
  return Object.fromEntries(years.map((year) => [yearKey(year), { label: String(year.year), color: "" }]));
}

/** Year delta as text (the shared DeltaBadge icon set is not part of the dashboard test mocks). */
function DeltaText({ delta, toDate, prefix, testId }: { delta: number | null; toDate?: boolean; prefix?: string; testId: string }) {
  const hasValue = delta !== null && Number.isFinite(delta);
  const tone = deltaTone(delta);
  return (
    <p className="text-xs font-medium" style={{ color: DELTA_COLORS[tone] }} data-testid={testId} data-ui={`${testId}-delta`}>
      {hasValue ? `${prefix ? `${prefix} · ` : ""}${formatPercent(delta as number)}${toDate ? " a misma fecha" : ""}` : "Sin año anterior"}
    </p>
  );
}

/**
 * Seasons fetch: one independent request per comparison so changing the month
 * of "comparativa de mes" never reloads the multi-month season panel.
 * Tag: manual_billing_stats_v1.
 */
export function useManualBillingSeasonal(months: number[]) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [data, setData] = useState<ManualBillingSeasonalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthKey = months.join(",");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.analytics
      .getManualBillingSeasonal(months)
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
        setError(loadError instanceof Error ? loadError.message : "Error cargando la comparativa");
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

/** Section "Comparativa de mes": one month across every year with entries, by 4 weeks. */
export function BillingMonthSeasonPanel({
  month,
  onMonthChange,
  years,
  loading,
  error,
  testId,
}: {
  month: number;
  onMonthChange: (month: number) => void;
  years: ManualBillingSeasonalYear[];
  loading: boolean;
  error: string | null;
  testId: string;
}) {
  const chartData = useMemo(
    () =>
      (["Semana 1", "Semana 2", "Semana 3", "Semana 4"] as const).map((weekLabel, weekIndex) => {
        const row: Record<string, string | number> = { week: weekLabel };
        for (const year of years) {
          const monthRow = year.months.find((entry) => entry.month === month);
          row[yearKey(year)] = monthRow?.weeks?.[weekIndex]?.grossEUR ?? 0;
        }
        return row;
      }),
    [years, month],
  );
  const chartConfig = useMemo(() => yearChartConfig(years), [years]);

  return (
    <AffluencePanel
      title={`Comparativa de mes · ${monthName(month)}`}
      description="El mismo mes de cada año con facturación manual, repartido en sus 4 semanas (1-7, 8-14, 15-21 y 22-fin)."
      icon={BarChart3}
      testId={testId}
      actions={
        <span className="text-xs text-[var(--bo-muted)]" data-testid={`${testId}-status`} data-ui={`${testId}-status`} data-loading={loading} data-error={Boolean(error)}>
          {error ? error : loading ? "Actualizando comparativa…" : `${years.length} años con datos`}
        </span>
      }
    >
      <div className="flex flex-col gap-4" data-ui={`${testId}-body`}>
        <div className="flex flex-wrap gap-2" data-testid={`${testId}-month-picker`} data-ui={`${testId}-month-picker`}>
          {MONTH_LABELS.map((label, index) => {
            const monthValue = index + 1;
            return (
              <ToggleChip
                key={`manual-billing-compare-month-${monthValue}`}
                label={label}
                active={monthValue === month}
                onClick={() => onMonthChange(monthValue)}
                testId={`${testId}-month-${monthValue}`}
              />
            );
          })}
        </div>
        {years.length === 0 ? (
          <ChartEmpty testId={`${testId}-empty`} message={`Sin facturación manual de ${monthName(month)} en el histórico.`} />
        ) : (
          <div className="flex flex-col gap-4" data-ui={`${testId}-results`}>
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={chartConfig} id={`${testId}-chart`} data-testid={`${testId}-chart`}>
              <BarChartPrimitive data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="week" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                {years.map((year, index) => (
                  <BarPrimitive key={`month-bar-${year.year}`} dataKey={yearKey(year)} name={String(year.year)} fill={yearColor(index)} radius={[3, 3, 0, 0]} />
                ))}
              </BarChartPrimitive>
            </ChartContainer>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-ui={`${testId}-year-boxes`}>
              {years.map((year, index) => {
                const monthRow = year.months.find((entry) => entry.month === month);
                const boxId = `${testId}-year-box-${year.year}`;
                return (
                  <div
                    key={`month-box-${year.year}`}
                    className="rounded-xl border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] p-3"
                    data-testid={boxId}
                    data-ui={`${boxId}-box`}
                    data-year={year.year}
                    data-partial={year.partial}
                  >
                    <div className="flex items-center justify-between gap-2" data-ui={`${boxId}-head`}>
                      <span className="flex items-center gap-2 text-sm font-semibold" data-testid={`${boxId}-year`} data-ui={`${boxId}-year`}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: yearColor(index) }} aria-hidden="true" data-ui={`${boxId}-dot`} />
                        {year.year}
                      </span>
                      {year.partial ? (
                        <span className="rounded-full border border-[var(--bo-color-warning)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bo-color-warning)]" data-testid={`${boxId}-partial`} data-ui={`${boxId}-partial`}>
                          En curso
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2" data-ui={`${boxId}-metrics`}>
                      <span className="text-xl font-semibold tracking-tight" data-testid={`${boxId}-gross`} data-ui={`${boxId}-gross`}>
                        {formatCurrency(monthRow?.grossEUR ?? 0)}
                      </span>
                      <span className="text-xs text-[var(--bo-muted)]" data-ui={`${boxId}-gross-label`}>
                        facturado
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--bo-muted)]" data-testid={`${boxId}-detail`} data-ui={`${boxId}-detail`}>
                      Base {formatCurrency(monthRow?.netEUR ?? 0)} · IVA {formatCurrency(monthRow?.vatEUR ?? 0)} · {formatNumber(monthRow?.entries ?? 0)} registros
                    </div>
                    <div className="mt-2" data-ui={`${boxId}-delta-slot`}>
                      <DeltaText delta={year.deltaPercentGross} toDate={year.deltaToDate} prefix={monthName(month)} testId={`${boxId}-delta`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AffluencePanel>
  );
}

/** Section "Comparativa de temporada": several months together, boxed per year. */
export function BillingSeasonPanel({
  months,
  onMonthsChange,
  years,
  loading,
  error,
  testId,
}: {
  months: number[];
  onMonthsChange: (months: number[]) => void;
  years: ManualBillingSeasonalYear[];
  loading: boolean;
  error: string | null;
  testId: string;
}) {
  const toggleMonth = (month: number) => {
    const next = months.includes(month) ? months.filter((value) => value !== month) : [...months, month].sort((a, b) => a - b);
    if (next.length === 0) return;
    onMonthsChange(next);
  };

  const chartData = useMemo(
    () =>
      months.map((month) => {
        const row: Record<string, string | number> = { month: monthName(month).slice(0, 3) };
        for (const year of years) {
          row[yearKey(year)] = year.months.find((entry) => entry.month === month)?.grossEUR ?? 0;
        }
        return row;
      }),
    [months, years],
  );
  const chartConfig = useMemo(() => yearChartConfig(years), [years]);

  return (
    <AffluencePanel
      title="Comparativa de temporada"
      description="Elige uno o varios meses y compara su facturación manual con la de los mismos meses de años anteriores."
      icon={TrendingUp}
      testId={testId}
      actions={
        <span className="text-xs text-[var(--bo-muted)]" data-testid={`${testId}-selection`} data-ui={`${testId}-selection`}>
          {months.map((month) => monthName(month)).join(" + ") || "Sin meses"}
        </span>
      }
    >
      <div className="flex flex-col gap-4" data-ui={`${testId}-body`}>
        <div className="flex flex-wrap gap-2" data-testid={`${testId}-month-picker`} data-ui={`${testId}-month-picker`}>
          {MONTH_LABELS.map((label, index) => {
            const month = index + 1;
            return (
              <ToggleChip
                key={`manual-billing-season-month-${month}`}
                label={label}
                active={months.includes(month)}
                onClick={() => toggleMonth(month)}
                testId={`${testId}-month-${month}`}
              />
            );
          })}
        </div>

        {error ? (
          <p className="text-xs text-[var(--bo-on-surface-danger)]" data-testid={`${testId}-error`} data-ui={`${testId}-error`}>
            {error}
          </p>
        ) : null}
        {years.length === 0 ? (
          <ChartEmpty testId={`${testId}-empty`} message="Sin facturación manual para los meses seleccionados." />
        ) : (
          <>
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={chartConfig} id={`${testId}-chart`} data-testid={`${testId}-chart`}>
              <BarChartPrimitive data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                {years.map((year, index) => (
                  <BarPrimitive key={`season-bar-${year.year}`} dataKey={yearKey(year)} name={String(year.year)} fill={yearColor(index)} radius={[3, 3, 0, 0]} />
                ))}
              </BarChartPrimitive>
            </ChartContainer>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-ui={`${testId}-year-boxes`}>
              {years.map((year, index) => {
                const boxId = `${testId}-year-${year.year}`;
                return (
                  <div
                    key={`season-box-${year.year}`}
                    className="rounded-xl border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] p-3"
                    data-testid={boxId}
                    data-ui={`${boxId}-box`}
                    data-year={year.year}
                    data-partial={year.partial}
                  >
                    <div className="flex items-center justify-between gap-2" data-ui={`${boxId}-head`}>
                      <span className="flex items-center gap-2 text-sm font-semibold" data-ui={`${boxId}-year-label`}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: yearColor(index) }} aria-hidden="true" data-ui={`${boxId}-year-dot`} />
                        {year.year}
                      </span>
                      {year.partial ? (
                        <span className="rounded-full border border-[var(--bo-color-warning)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bo-color-warning)]" data-testid={`${boxId}-partial`} data-ui={`${boxId}-year-partial`}>
                          En curso
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2" data-ui={`${boxId}-metrics`}>
                      <span className="text-xl font-semibold tracking-tight" data-testid={`${boxId}-gross`} data-ui={`${boxId}-year-gross`}>
                        {formatCurrency(year.grossEUR)}
                      </span>
                      <span className="text-xs text-[var(--bo-muted)]" data-ui={`${boxId}-gross-label`}>
                        facturado
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--bo-muted)]" data-testid={`${boxId}-detail`} data-ui={`${boxId}-year-detail`}>
                      Base {formatCurrency(year.netEUR)} · IVA {formatCurrency(year.vatEUR)} · {formatNumber(year.entries)} registros
                    </div>
                    <div className="mt-2" data-ui={`${boxId}-delta-slot`}>
                      <DeltaText delta={year.deltaPercentGross} toDate={year.deltaToDate} testId={`${boxId}-delta`} />
                    </div>
                    <ul className="mt-3 flex flex-col gap-1" data-ui={`${boxId}-months`}>
                      {year.months.map((monthRow) => (
                        <li
                          key={`season-month-${year.year}-${monthRow.month}`}
                          className="flex items-center justify-between gap-2 text-xs"
                          data-testid={`${boxId}-month-${monthRow.month}`}
                          data-ui={`${boxId}-month-${monthRow.month}`}
                        >
                          <span className="text-[var(--bo-muted)]" data-ui={`${boxId}-month-name-${monthRow.month}`}>
                            {monthName(monthRow.month)}
                          </span>
                          <span className="font-semibold" data-ui={`${boxId}-month-gross-${monthRow.month}`}>
                            {formatCurrency(monthRow.grossEUR)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className="text-xs text-[var(--bo-muted)]" data-testid={`${testId}-status`} data-ui={`${testId}-status`} data-loading={loading}>
          {loading ? "Actualizando comparativa…" : "Datos del histórico de facturación manual."}
        </p>
      </div>
    </AffluencePanel>
  );
}
