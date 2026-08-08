import React, { useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Coins } from "lucide-react";

import type { LabourCostReport as Report, FichajeActiveEntry } from "../../../../../api/types";
import { fichajeRealtimeAtom } from "../../../../../state/atoms";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { Panel } from "../../../../../ui/shell/Panel";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from "../../../../../ui/shadcn/chart";

type Props = { report: Report | null; loading: boolean; onRangeChange: (from: string, to: string) => void };

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(2).replace(".", ",")} h`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function elapsedMinutes(entry: FichajeActiveEntry, nowMs: number): number {
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return 0;
  return Math.max(0, (nowMs - startMs) / 60000);
}

const chartConfig = {
  gross: {
    label: "Facturado",
    color: "hsl(var(--accent))",
  },
  cost: {
    label: "Coste plantilla",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function LabourCostReport({ report, loading, onRangeChange }: Props) {
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const [tick, setTick] = useState(() => Date.now());
  const [from, setFrom] = useState(report?.from || todayISO());
  const [to, setTo] = useState(report?.to || todayISO());

  const activeEntriesForDate = useMemo(() => {
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== to) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [realtime.activeEntriesByMember, to]);

  useEffect(() => {
    if (activeEntriesForDate.size === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeEntriesForDate.size]);

  const hourlyByMember = useMemo(() => {
    const out = new Map<number, number>();
    for (const item of realtime.hourlyCosts) out.set(item.memberId, item.effectiveHourlyCost);
    return out;
  }, [realtime.hourlyCosts]);

  // Live cost: closed entries from the report + in-progress clock entries.
  const { totalMinutes, totalCost, members } = useMemo(() => {
    const baseMinutes = report?.totalMinutes ?? 0;
    const baseCost = report?.totalCost ?? 0;
    const memberRows = new Map<number, { memberId: number; name: string; minutesWorked: number; cost: number; missingCompensation: boolean }>();
    for (const item of report?.members ?? []) {
      memberRows.set(item.memberId, { ...item });
    }
    let minutes = baseMinutes;
    let cost = baseCost;
    for (const [memberId, entry] of activeEntriesForDate) {
      const elapsed = elapsedMinutes(entry, tick);
      const hourly = hourlyByMember.get(memberId) ?? 0;
      const liveCost = (elapsed / 60) * hourly;
      minutes += elapsed;
      cost += liveCost;
      const existing = memberRows.get(memberId);
      if (existing) {
        existing.minutesWorked += elapsed;
        existing.cost += liveCost;
      } else {
        memberRows.set(memberId, { memberId, name: entry.memberName, minutesWorked: elapsed, cost: liveCost, missingCompensation: hourly <= 0 });
      }
    }
    return {
      totalMinutes: minutes,
      totalCost: cost,
      members: Array.from(memberRows.values()).sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" })),
    };
  }, [activeEntriesForDate, hourlyByMember, report, tick]);

  const seriesData = useMemo(
    () =>
      realtime.ticketSeries.map((point) => ({
        time: point.time,
        gross: point.grossCents,
        cost: point.costCents,
      })),
    [realtime.ticketSeries],
  );

  const revenueTotal = realtime.posRevenueToday?.totalGrossCents ?? 0;
  const revenueCents = revenueTotal;
  const costCents = Math.round(totalCost * 100);
  const balanceCents = revenueCents - costCents;
  const isPositive = balanceCents >= 0;

  return (
    <section className="bo-labourReport" data-ui="labour-report">
      <Panel
        title={
          <span className="bo-labourReportTitle" data-ui="labour-report-title">
            <Coins size={16} strokeWidth={1.8} aria-hidden="true" />
            Coste laboral por fichajes
          </span>
        }
        meta="Horas reales × coste empresa vigente cada día. En tiempo real."
        headClassName="bo-labourReportHead"
        data-testid="labour-report-panel"
      >
        <div className="bo-labourReportRange" data-ui="labour-report-range">
          <label className="bo-labourReportRangeField" data-ui="labour-report-from-label">
            <span data-ui="labour-report-from-text">Desde</span>
            <DatePicker
              value={from}
              onChange={(next) => {
                setFrom(next);
                onRangeChange(next, to);
              }}
              data-testid="labour-report-from"
            />
          </label>
          <label className="bo-labourReportRangeField" data-ui="labour-report-to-label">
            <span data-ui="labour-report-to-text">Hasta</span>
            <DatePicker
              value={to}
              onChange={(next) => {
                setTo(next);
                onRangeChange(from, next);
              }}
              data-testid="labour-report-to"
            />
          </label>
          {loading ? <span className="bo-mutedText" data-ui="labour-report-loading">Actualizando...</span> : null}
        </div>

        <div className="bo-labourReportSummary" data-ui="labour-report-summary">
          <div className="bo-kv" data-ui="labour-report-hours">
            <span className="bo-kvLabel" data-ui="labour-report-hours-label">Horas</span>
            <strong className="bo-kvValue" data-ui="labour-report-hours-value">{hoursLabel(totalMinutes)}</strong>
          </div>
          <div className="bo-kv" data-ui="labour-report-cost">
            <span className="bo-kvLabel" data-ui="labour-report-cost-label">Coste</span>
            <strong className="bo-kvValue" data-ui="labour-report-cost-value">{money.format(totalCost)}</strong>
          </div>
        </div>

        <div className="bo-labourReportMembers" data-ui="labour-report-members">
          {members.map((item) => (
            <div className="bo-labourReportMember" key={item.memberId} data-ui="labour-report-member">
              <span className="bo-labourReportMemberName" data-ui="labour-report-member-name">
                {item.name}
                {activeEntriesForDate.has(item.memberId) ? <span className="bo-horariosLiveDot" aria-hidden="true" data-ui="labour-report-member-live" /> : null}
                {item.missingCompensation ? <span className="bo-badge bo-badge--warn" data-ui="labour-report-member-missing">sin salario</span> : null}
              </span>
              <strong className="bo-labourReportMemberCost" data-ui="labour-report-member-cost">
                {hoursLabel(item.minutesWorked)} · {money.format(item.cost)}
              </strong>
            </div>
          ))}
        </div>

        {report?.missingCompensationMembers.length ? (
          <p className="bo-labourReportMissing" role="alert" data-ui="labour-report-missing">
            Falta salario: {report.missingCompensationMembers.join(", ")}
          </p>
        ) : null}

        <div className="bo-labourReportRevenue" data-ui="labour-report-revenue">
          <div className="bo-labourReportRevenueHead" data-ui="labour-report-revenue-head">
            <strong data-ui="labour-report-revenue-title">Ingresos hoy</strong>
            <span className="bo-badge bo-badge--ok" data-ui="labour-report-revenue-total">{money.format(revenueCents / 100)}</span>
          </div>
          {realtime.posRevenueToday?.byHour.length ? (
            <div className="bo-labourReportRevenueHours" data-ui="labour-report-revenue-hours">
              {realtime.posRevenueToday.byHour
                .slice()
                .sort((a, b) => a.hour - b.hour)
                .map((h) => (
                  <span className="bo-labourReportRevenueHour" key={h.hour} data-ui="labour-report-revenue-hour">
                    {String(h.hour).padStart(2, "0")}:00 · {money.format(h.grossCents / 100)}
                  </span>
                ))}
            </div>
          ) : (
            <p className="bo-mutedText" data-ui="labour-report-revenue-empty">Sin tickets abiertos hoy.</p>
          )}
        </div>

        <div className="bo-labourReportChart" data-ui="labour-report-chart">
          <ChartContainer config={chartConfig} className="h-[240px] w-full" data-testid="labour-report-chart" aria-label="Facturado frente a coste de plantilla">
            <AreaChart data={seriesData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <defs>
                <linearGradient id="labour-fill-gross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gross)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-gross)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="labour-fill-cost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--bo-border, rgba(148,163,184,0.2))" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval={11}
                stroke="var(--bo-muted)"
              />
              <YAxis tick={{ fontSize: 10 }} width={46} tickLine={false} axisLine={false} stroke="var(--bo-muted)" tickFormatter={(v: number) => money.format(Number(v) / 100)} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: unknown, name: string) => (
                      <span className="tabular-nums" data-ui="labour-report-chart-tooltip-value">{money.format(Number(value) / 100)}</span>
                    )}
                  />
                }
              />
              <Area type="monotone" dataKey="gross" name="gross" stroke="var(--color-gross)" fill="url(#labour-fill-gross)" fillOpacity={0.12} strokeWidth={2} />
              <Area type="monotone" dataKey="cost" name="cost" stroke="var(--color-cost)" fill="url(#labour-fill-cost)" fillOpacity={0.12} strokeWidth={2} />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        </div>

        <div
          className={`bo-labourReportBalance ${isPositive ? "is-positive" : "is-negative"}`}
          role="status"
          aria-live="polite"
          data-ui="labour-report-balance"
        >
          {isPositive ? <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" /> : <ArrowDownRight size={18} strokeWidth={2} aria-hidden="true" />}
          <div className="bo-labourReportBalanceBody" data-ui="labour-report-balance-body">
            <span className="bo-labourReportBalanceLabel" data-ui="labour-report-balance-label">{isPositive ? "Beneficio" : "Coste superior al facturado"}</span>
            <strong className="bo-labourReportBalanceValue" data-ui="labour-report-balance-value">{money.format(Math.abs(balanceCents) / 100)}</strong>
          </div>
        </div>
      </Panel>
    </section>
  );
}
