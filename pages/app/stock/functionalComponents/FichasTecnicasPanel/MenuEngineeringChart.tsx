import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import { BarChart3, ChevronDown } from "lucide-react";

import { Button } from "../../../../../ui/actions/Button";
import { EmptyState } from "../../../../../ui/feedback/EmptyState";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { LoadingSpinner } from "../../../../../ui/feedback/LoadingSpinner";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "../../../../../ui/shadcn/chart";

// Menu engineering (Kasavana-Smith) over the recipe-costing sales mix the
// backend computes: x = units sold, y = contribution margin %, split by the
// popularity threshold (70% of the average sold) and the units-weighted
// average margin the API returns in salesMix. Only recipes wired to POS
// products with PAID tickets appear.

type CostingItem = {
  recipeId: number;
  name: string;
  sold: number;
  tickets: number;
  marginPct: number;
  grossMargin: number;
  class: string;
};

type SalesMix = {
  days: number;
  totalSold: number;
  recipesWithSales: number;
  avgSold: number;
  weightedAvgMargin: number;
  classified: boolean;
};

const CLASS_META: Record<string, { label: string; color: string }> = {
  star: { label: "Estrellas", color: "#16a34a" },
  plowhorse: { label: "Corceles", color: "#2563eb" },
  puzzle: { label: "Enigmas", color: "#d97706" },
  dog: { label: "Perros", color: "#dc2626" },
};

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  Object.entries(CLASS_META).map(([key, meta]) => [key, { label: meta.label, color: meta.color }]),
);

type TooltipPayloadItem = { payload: CostingItem };

function MenuengTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  const meta = CLASS_META[item.class];
  return (
    <div className="bo-menuengTip" data-ui="menueng-tooltip">
      <strong data-ui="menueng-tooltip-name">{item.name}</strong>
      <span data-ui="menueng-tooltip-sales">{item.sold} uds · {item.tickets} tickets</span>
      <span data-ui="menueng-tooltip-margin">Margen {item.marginPct.toFixed(1)}%</span>
      <span className="bo-menuengTipClass" style={meta ? { color: meta.color } : undefined} data-ui="menueng-tooltip-class">
        {meta?.label || item.class || "Sin clase"}
      </span>
    </div>
  );
}

export function MenuEngineeringChart() {
  const [days, setDays] = useState("90");
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<CostingItem[]>([]);
  const [mix, setMix] = useState<SalesMix | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/admin/stock/costing?salesDays=${encodeURIComponent(days)}`, { credentials: "include", signal: controller.signal })
      .then((response) => response.json())
      .then((body) => {
        if (cancelled) return;
        if (!body.success) throw new Error(body.message || "No se pudo cargar el análisis");
        setItems(Array.isArray(body.items) ? body.items : []);
        setMix(body.salesMix || null);
        setError("");
      })
      .catch((reason) => {
        if (cancelled || (reason instanceof DOMException && reason.name === "AbortError")) return;
        setError(reason instanceof Error ? reason.message : "No se pudo cargar el análisis");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [days]);

  const soldItems = useMemo(() => items.filter((item) => item.sold > 0), [items]);
  const avgMarginPct = useMemo(() => {
    const totalSold = soldItems.reduce((sum, item) => sum + item.sold, 0);
    if (totalSold <= 0) return 0;
    return soldItems.reduce((sum, item) => sum + item.sold * item.marginPct, 0) / totalSold;
  }, [soldItems]);
  const popularityThreshold = mix && mix.avgSold > 0 ? 0.7 * mix.avgSold : 0;
  const byClass = useMemo(() => {
    const groups: Record<string, CostingItem[]> = {};
    for (const item of soldItems) {
      const key = item.class || "puzzle";
      (groups[key] ||= []).push(item);
    }
    return groups;
  }, [soldItems]);

  return (
    <section className="bo-menueng" aria-label="Ingeniería de menú" data-ui="menueng-section">
      <div className="bo-menuengHead" data-ui="menueng-head">
        <BarChart3 size={18} aria-hidden="true" data-ui="menueng-icon" />
        <h3 className="bo-stockSubtitle" data-ui="menueng-title">Ingeniería de menú</h3>
        <select
          className="bo-input bo-menuengDays"
          value={days}
          aria-label="Periodo de ventas"
          onChange={(event) => setDays(event.target.value)}
          data-ui="menueng-days"
          data-testid="menueng-days"
        >
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
          <option value="365">Últimos 365 días</option>
        </select>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          data-ui="menueng-toggle"
          data-testid="menueng-toggle"
        >
          {open ? "Ocultar" : "Mostrar"}
          <ChevronDown size={14} aria-hidden="true" style={{ transform: open ? undefined : "rotate(-90deg)" }} />
        </Button>
      </div>
      {open ? (
        loading ? (
          <LoadingSpinner centered size="sm" label="Cargando análisis de menú…" />
        ) : error ? (
          <InlineAlert kind="error" title={error} />
        ) : !mix || mix.totalSold <= 0 ? (
          <EmptyState
            icon={<BarChart3 size={32} aria-hidden="true" />}
            title="Sin ventas todavía"
            description="El análisis aparecerá cuando el POS registre ventas de productos vinculados a fichas técnicas."
            data-ui="menueng-empty"
          />
        ) : (
          <div data-ui="menueng-body">
            <p className="bo-stockMuted" data-ui="menueng-summary">
              {mix.totalSold} uds en {mix.days} días · {soldItems.length} fichas con ventas · margen medio ponderado {avgMarginPct.toFixed(1)}%
            </p>
            <ChartContainer
              config={CHART_CONFIG}
              className="h-72 w-full bo-menuengChart"
              aria-label="Ingeniería de menú: unidades vendidas frente a margen"
              data-ui="menueng-chart"
              data-testid="menueng-chart"
            >
              <ScatterChart margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="sold"
                  name="Ventas"
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                  label={{ value: "Unidades vendidas", position: "insideBottom", offset: -4, fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="marginPct"
                  name="Margen %"
                  width={44}
                  tickFormatter={(value: number) => `${Math.round(value)}%`}
                  tick={{ fontSize: 12 }}
                  stroke="currentColor"
                />
                <ChartTooltip content={<MenuengTooltip />} />
                <ChartLegend content={<ChartLegendContent />} />
                <ReferenceLine x={popularityThreshold} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "70% de las ventas medias", position: "top", fontSize: 11 }} />
                <ReferenceLine y={avgMarginPct} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Margen medio", position: "insideTopRight", fontSize: 11 }} />
                {Object.entries(CLASS_META).map(([key, meta]) => (
                  <Scatter key={key} name={meta.label} data={byClass[key] || []} fill={meta.color} fillOpacity={0.85} />
                ))}
              </ScatterChart>
            </ChartContainer>
          </div>
        )
      ) : null}
    </section>
  );
}
