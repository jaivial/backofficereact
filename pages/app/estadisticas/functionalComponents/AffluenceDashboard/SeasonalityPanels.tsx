import React, { useMemo } from "react";
import { CalendarDays, Layers } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import type { AffluenceSeasonalYear } from "../../../../../api/types";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../../../../ui/shadcn/chart";
import {
  MONTH_LABELS,
  formatNumber,
  monthName,
  seasonYearTotals,
  yearColor,
} from "./affluenceUtils";
import { AffluencePanel, ChartEmpty, DeltaBadge, ToggleChip } from "./affluenceWidgets";

const BarChartPrimitive = BarChart as React.ComponentType<any>;
const BarPrimitive = Bar as React.ComponentType<any>;
const CartesianGridPrimitive = CartesianGrid as React.ComponentType<any>;
const XAxisPrimitive = XAxis as React.ComponentType<any>;
const YAxisPrimitive = YAxis as React.ComponentType<any>;

function YearBox({
  year,
  index,
  color,
  testId,
}: {
  year: AffluenceSeasonalYear;
  index: number;
  color: string;
  testId: string;
}) {
  return (
    <div
      className="rounded-xl border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] p-3"
      data-testid={testId}
      data-ui={`${testId}-box`}
      data-year={year.year}
      data-partial={year.partial}
    >
      <div className="flex items-center justify-between gap-2" data-ui={`${testId}-head`}>
        <span className="flex items-center gap-2 text-sm font-semibold" data-testid={`${testId}-year`} data-ui={`${testId}-year`}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" data-ui={`${testId}-dot`} />
          {year.year}
        </span>
        {year.partial ? (
          <span className="rounded-full border border-[var(--bo-color-warning)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bo-color-warning)]" data-testid={`${testId}-partial`} data-ui={`${testId}-partial`}>
            En curso
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2" data-ui={`${testId}-metrics`}>
        <span className="text-xl font-semibold tracking-tight" data-testid={`${testId}-covers`} data-ui={`${testId}-covers`}>
          {formatNumber(year.covers)}
        </span>
        <span className="text-xs text-[var(--bo-muted)]" data-ui={`${testId}-covers-label`}>
          comensales
        </span>
      </div>
      <div className="mt-1 text-xs text-[var(--bo-muted)]" data-testid={`${testId}-bookings`} data-ui={`${testId}-bookings`}>
        {formatNumber(year.bookings)} reservas
      </div>
      <div className="mt-2" data-ui={`${testId}-delta-slot`}>
        <DeltaBadge delta={year.deltaPercentCovers} prefix={year.deltaToDate ? "a misma fecha" : undefined} size="sm" testId={`${testId}-delta`} />
      </div>
    </div>
  );
}

/** Section "Comparativa de mes": one month compared across every year with data, by 4 weeks. */
export function MonthSeasonPanel({
  month,
  onMonthChange,
  years,
  loading,
  error,
  testId,
}: {
  month: number;
  onMonthChange: (month: number) => void;
  years: AffluenceSeasonalYear[];
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
          row[`y${year.year}`] = monthRow?.weeks?.[weekIndex]?.covers ?? 0;
        }
        return row;
      }),
    [years, month],
  );

  const chartConfig = useMemo(() => Object.fromEntries(years.map((year) => [`y${year.year}`, { label: String(year.year), color: "" }])), [years]);

  return (
    <AffluencePanel
      title={`Comparativa de mes · ${monthName(month)}`}
      description="El mismo mes de cada año con datos, repartido en sus 4 semanas (1-7, 8-14, 15-21 y 22-fin)."
      icon={CalendarDays}
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
                key={`compare-month-${monthValue}`}
                label={label}
                active={monthValue === month}
                onClick={() => onMonthChange(monthValue)}
                testId={`${testId}-month-${monthValue}`}
              />
            );
          })}
        </div>
        {years.length === 0 ? (
          <ChartEmpty testId={`${testId}-empty`} message={`Sin reservas de ${monthName(month)} en el histórico.`} />
        ) : (
          <div className="flex flex-col gap-4" data-ui={`${testId}-results`}>
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={chartConfig} id={`${testId}-chart`} data-testid={`${testId}-chart`}>
              <BarChartPrimitive data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="week" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                {years.map((year, index) => (
                  <BarPrimitive
                    key={`bar-${year.year}`}
                    dataKey={`y${year.year}`}
                    name={String(year.year)}
                    fill={yearColor(index)}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChartPrimitive>
            </ChartContainer>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-ui={`${testId}-year-boxes`}>
              {years.map((year, index) => (
                <YearBox
                  key={`box-${year.year}`}
                  year={year}
                  index={index}
                  color={yearColor(index)}
                  testId={`${testId}-year-box-${year.year}`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AffluencePanel>
  );
}

/** Section "Comparativa de temporada": several months together, boxed per year. */
export function SeasonPanel({
  months,
  onMonthsChange,
  years,
  loading,
  error,
  testId,
}: {
  months: number[];
  onMonthsChange: (months: number[]) => void;
  years: AffluenceSeasonalYear[];
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
          row[`y${year.year}`] = year.months.find((entry) => entry.month === month)?.covers ?? 0;
        }
        return row;
      }),
    [months, years],
  );

  const chartConfig = useMemo(() => Object.fromEntries(years.map((year) => [`y${year.year}`, { label: String(year.year), color: "" }])), [years]);

  return (
    <AffluencePanel
      title="Comparativa de temporada"
      description="Elige uno o varios meses y compáralos con los mismos meses de los años anteriores."
      icon={Layers}
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
            const active = months.includes(month);
            return (
              <ToggleChip
                key={`month-chip-${month}`}
                label={label}
                active={active}
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
          <ChartEmpty testId={`${testId}-empty`} message="Sin reservas para los meses seleccionados." />
        ) : (
          <>
            <ChartContainer className="h-60 min-h-56 sm:h-72 sm:min-h-60" config={chartConfig} id={`${testId}-chart`} data-testid={`${testId}-chart`}>
              <BarChartPrimitive data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGridPrimitive vertical={false} stroke="var(--bo-border)" />
                <XAxisPrimitive dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <YAxisPrimitive tickLine={false} axisLine={false} tickMargin={8} tick={{ fill: "var(--bo-muted)", fontSize: 11 }} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                {years.map((year, index) => (
                  <BarPrimitive
                    key={`season-bar-${year.year}`}
                    dataKey={`y${year.year}`}
                    name={String(year.year)}
                    fill={yearColor(index)}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChartPrimitive>
            </ChartContainer>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-ui={`${testId}-year-boxes`}>
              {years.map((year, index) => {
                const totals = seasonYearTotals(year);
                return (
                  <div
                    key={`season-box-${year.year}`}
                    className="rounded-xl border border-[var(--bo-border-2)] bg-[var(--bo-surface-3)] p-3"
                    data-testid={`${testId}-year-${year.year}`}
                    data-ui={`${testId}-year-box-${year.year}`}
                    data-year={year.year}
                    data-partial={year.partial}
                  >
                    <div className="flex items-center justify-between gap-2" data-ui={`${testId}-year-head-${year.year}`}>
                      <span className="flex items-center gap-2 text-sm font-semibold" data-ui={`${testId}-year-label-${year.year}`}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: yearColor(index) }} aria-hidden="true" data-ui={`${testId}-year-dot-${year.year}`} />
                        {year.year}
                      </span>
                      {year.partial ? (
                        <span className="rounded-full border border-[var(--bo-color-warning)] px-2 py-0.5 text-[11px] font-semibold text-[var(--bo-color-warning)]" data-testid={`${testId}-year-${year.year}-partial`} data-ui={`${testId}-year-partial-${year.year}`}>
                          En curso
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-baseline gap-2" data-ui={`${testId}-year-metrics-${year.year}`}>
                      <span className="text-xl font-semibold tracking-tight" data-testid={`${testId}-year-${year.year}-covers`} data-ui={`${testId}-year-covers-${year.year}`}>
                        {formatNumber(totals.covers)}
                      </span>
                      <span className="text-xs text-[var(--bo-muted)]" data-ui={`${testId}-year-covers-label-${year.year}`}>
                        comensales
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-[var(--bo-muted)]" data-ui={`${testId}-year-bookings-${year.year}`}>
                      {formatNumber(totals.bookings)} reservas
                    </div>
                    <div className="mt-2" data-ui={`${testId}-year-delta-${year.year}`}>
                      <DeltaBadge delta={year.deltaPercentCovers} prefix={year.deltaToDate ? "a misma fecha" : undefined} size="sm" testId={`${testId}-year-${year.year}-delta`} />
                    </div>
                    <ul className="mt-3 flex flex-col gap-1" data-ui={`${testId}-year-months-${year.year}`}>
                      {year.months.map((monthRow) => (
                        <li
                          key={`season-month-${year.year}-${monthRow.month}`}
                          className="flex items-center justify-between gap-2 text-xs"
                          data-testid={`${testId}-year-${year.year}-month-${monthRow.month}`}
                          data-ui={`${testId}-year-month-${year.year}-${monthRow.month}`}
                        >
                          <span className="text-[var(--bo-muted)]" data-ui={`${testId}-year-month-name-${year.year}-${monthRow.month}`}>
                            {monthName(monthRow.month)}
                          </span>
                          <span className="font-semibold" data-ui={`${testId}-year-month-covers-${year.year}-${monthRow.month}`}>
                            {formatNumber(monthRow.covers)}
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
          {loading ? "Actualizando comparativa…" : "Datos del histórico completo de reservas."}
        </p>
      </div>
    </AffluencePanel>
  );
}
