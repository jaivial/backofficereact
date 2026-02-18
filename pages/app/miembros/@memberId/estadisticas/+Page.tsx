import React, { useCallback, useMemo, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { usePageContext } from "vike-react/usePageContext";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { createClient } from "../../../../../api/client";
import type { MemberStats, MemberTimeBalance } from "../../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { Select } from "../../../../../ui/inputs/Select";
import { DatePicker } from "../../../../../ui/inputs/DatePicker";
import { applyLiveToBalance, applyLiveToStats, maxHours, useMemberLive } from "../_shared/realtime";
import { StatsTable } from "./_components/StatsTable";

type StatsView = "weekly" | "monthly" | "quarterly" | "yearly";
type ChartType = "bar" | "linear";

const statsViewOptions: { value: string; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
];

const chartTypeOptions: { value: string; label: string }[] = [
  { value: "bar", label: "Barras" },
  { value: "linear", label: "Linear" },
];

function parseStatsView(v: string): StatsView {
  if (v === "monthly") return "monthly";
  if (v === "quarterly") return "quarterly";
  if (v === "yearly") return "yearly";
  return "weekly";
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [view, setView] = useState<StatsView>("weekly");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [date, setDate] = useState(data.date);
  const [loadingStats, setLoadingStats] = useState(false);
  const [stats, setStats] = useState<MemberStats | null>(data.initialStats);
  const [balance, setBalance] = useState<MemberTimeBalance | null>(data.initialBalance);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const { liveEntry, liveHours } = useMemberLive(data.memberId);

  const reloadStats = useCallback(
    async (nextView: StatsView, nextDate: string) => {
      if (!data.memberId) return;
      setLoadingStats(true);
      setError(null);
      try {
        const [statsRes, balanceRes] = await Promise.all([
          api.members.getStats(data.memberId, { view: nextView, date: nextDate }),
          api.members.getTimeBalance(data.memberId, nextDate),
        ]);
        if (statsRes.success) setStats(statsRes);
        else setError(statsRes.message || "Error cargando estadisticas");

        if (balanceRes.success) setBalance(balanceRes);
        else setError(balanceRes.message || "Error cargando bolsa trimestral");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error cargando estadisticas");
      } finally {
        setLoadingStats(false);
      }
    },
    [api.members, data.memberId],
  );

  const onRefreshStats = useCallback(() => {
    void reloadStats(view, date);
  }, [date, reloadStats, view]);

  const statsLive = useMemo(() => applyLiveToStats(stats, liveEntry, liveHours, date), [date, liveEntry, liveHours, stats]);
  const balanceLive = useMemo(() => applyLiveToBalance(balance, liveEntry, liveHours), [balance, liveEntry, liveHours]);

  const chartMax = maxHours(statsLive);
  const weeklyPercent = statsLive?.summary.weeklyProgressPercent ?? 0;
  const weeklyProgress = Math.max(0, Math.min(100, weeklyPercent));
  const balanceHours = balanceLive?.balanceHours ?? 0;
  const points = statsLive?.points ?? [];

  return (
    <section aria-label="Estadisticas del miembro" className="bo-content-grid bo-memberDetailPage">
      <div className="bo-panel bo-memberStatsPanel">
        <div className="bo-panelHead bo-memberStatsHead">
          <div>
            <div className="bo-panelTitle">Estadisticas</div>
            <div className="bo-panelMeta">Horas trabajadas y progreso respecto al contrato semanal.</div>
          </div>
          <div className="bo-memberStatsControls">
            <label className="bo-field bo-memberControl">
              <span className="bo-label">Vista</span>
              <Select
                className="bo-memberControlSelect"
                value={view}
                onChange={(value) => {
                  const nextView = parseStatsView(value);
                  setView(nextView);
                  void reloadStats(nextView, date);
                }}
                options={statsViewOptions}
                size="sm"
                ariaLabel="Vista"
              />
            </label>
            <label className="bo-field bo-memberControl">
              <span className="bo-label">Grafico</span>
              <Select
                className="bo-memberControlSelect"
                value={chartType}
                onChange={(value) => setChartType(value as ChartType)}
                options={chartTypeOptions}
                size="sm"
                ariaLabel="Tipo de grafico"
              />
            </label>
            <label className="bo-field bo-memberControl">
              <span className="bo-label">Fecha</span>
              <DatePicker
                value={date}
                popoverOffsetX={-40}
                onChange={(nextDate) => {
                  setDate(nextDate);
                  void reloadStats(view, nextDate);
                }}
              />
            </label>
            <button className="bo-actionBtn bo-memberRefreshBtn" type="button" onClick={onRefreshStats} disabled={loadingStats} aria-label="Recargar estadisticas">
              <RefreshCcw size={14} className={`bo-memberRefreshIcon${loadingStats ? " is-spinning" : ""}`} />
            </button>
          </div>
        </div>

        <div className="bo-panelBody bo-memberStatsBody">
          <div className="bo-memberProgress">
            <div className="bo-memberProgressTop">
              <span className="bo-mutedText">Cumplimiento semanal</span>
              <strong>{weeklyPercent.toFixed(2)}%</strong>
            </div>
            <div className="bo-memberProgressTrack">
              <span className="bo-memberProgressFill" style={{ width: `${weeklyProgress}%` }} />
            </div>
          </div>

          <div className="bo-memberBarsSection">
            <div className="bo-mutedText">
              Periodo {statsLive?.startDate ?? "-"} {"->"} {statsLive?.endDate ?? "-"}
            </div>
            {chartType === "bar" ? (
              <div className="bo-memberBarsScroll">
                <div
                  className="bo-memberBarsGrid"
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(42px, 1fr))`,
                  }}
                >
                  {points.map((point) => {
                    const h = (point.hours / chartMax) * 100;
                    return (
                      <div key={point.date} className="bo-memberBarCol">
                        <div className="bo-memberBarValue">{point.hours.toFixed(1)}</div>
                        <div className="bo-memberBarTrack">
                          <div className="bo-memberBarFill" style={{ height: `${Math.max(h, 3)}%` }} />
                        </div>
                        <div className="bo-memberBarLabel">{point.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bo-memberLinearChart">
                <div className="bo-memberLinearScroll" style={{ minWidth: `${Math.max(points.length, 1) * 60}px` }}>
                  <ResponsiveContainer width={Math.max(points.length, 1) * 60} height={220}>
                    <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="rgba(185, 168, 255, 0.5)" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="rgba(185, 168, 255, 0.1)" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(238, 240, 246, 0.42)", fontSize: 11 }}
                      tickMargin={8}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(238, 240, 246, 0.42)", fontSize: 11 }}
                      tickFormatter={(v) => v.toFixed(1)}
                      domain={[0, chartMax]}
                      width={40}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(34, 35, 43, 0.95)",
                        border: "1px solid rgba(255, 255, 255, 0.06)",
                        borderRadius: "12px",
                        padding: "8px 12px",
                        fontSize: "12px",
                      }}
                      labelStyle={{ color: "rgba(238, 240, 246, 0.86)", fontWeight: 720 }}
                      itemStyle={{ color: "rgba(185, 168, 255, 0.96)" }}
                      formatter={(value) => [`${Number(value).toFixed(2)} h`, "Horas"]}
                      cursor={{ stroke: "rgba(185, 168, 255, 0.3)", strokeWidth: 1 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="rgba(185, 168, 255, 0.96)"
                      strokeWidth={2.5}
                      fill="url(#colorHours)"
                      dot={{ fill: "rgba(185, 168, 255, 0.96)", strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 6, fill: "rgba(185, 168, 255, 1)" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>
            )}
            {points.length ? null : <div className="bo-mutedText">Sin datos de horas para el periodo seleccionado.</div>}
          </div>

          <div className="bo-memberSummaryGrid">
            <div className="bo-kv">
              <div className="bo-kvLabel">Horas trabajadas</div>
              <div className="bo-kvValue">{(statsLive?.summary.workedHours ?? 0).toFixed(2)} h</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Horas esperadas</div>
              <div className="bo-kvValue">{(statsLive?.summary.expectedHours ?? 0).toFixed(2)} h</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Progreso periodo</div>
              <div className="bo-kvValue">{(statsLive?.summary.progressPercent ?? 0).toFixed(2)}%</div>
            </div>
            <div className="bo-kv">
              <div className="bo-kvLabel">Bolsa trimestral</div>
              <div className={`bo-kvValue bo-memberBalance${balanceHours >= 0 ? " is-positive" : " is-negative"}`}>
                {balanceHours >= 0 ? "+" : ""}
                {balanceHours.toFixed(2)} h
              </div>
            </div>
          </div>
          <div className="bo-memberQuarterNote">
            Bolsa trimestral: {balanceLive?.quarter.startDate ?? "-"} {"->"} {balanceLive?.quarter.cutoffDate ?? "-"} (trimestre natural).
          </div>
        </div>
      </div>

      {/* Stats Table Section */}
      <div className="bo-panel bo-statsTablePanel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle">Tabla de Estadisticas</div>
            <div className="bo-panelMeta">Datos detallados por período completo del año.</div>
          </div>
        </div>
        <div className="bo-panelBody">
          {data.memberId > 0 ? (
            <StatsTable memberId={data.memberId} />
          ) : (
            <div className="bo-mutedText">Selecciona un miembro para ver las estadísticas.</div>
          )}
        </div>
      </div>
    </section>
  );
}
