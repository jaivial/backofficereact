import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, Calendar, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, MessageCircle, RefreshCcw, Send, Wallet } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type {
  AIUsagePayload,
  MessagingGranularity,
  WhatsAppLogPayload,
  WhatsAppLogRow,
} from "../../../../../api/types";
import { Button } from "../../../../../ui/actions/Button";
import { DateRangePicker } from "../../../../../ui/inputs/DateRangePicker";
import { Select } from "../../../../../ui/inputs/Select";
import { SimpleTabs } from "../../../../../ui/nav/SimpleTabs";
import { useGlobalSocketTopic } from "../../../../../ui/realtime/GlobalSocketProvider";
import { cn } from "../../../../../ui/shadcn/utils";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 6 });
const NUMBER = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const COMPACT = new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 });

const GRANULARITY_TABS = [
  { id: "week", label: "Semana", title: "Agrupar por semana", icon: <CalendarDays size={16} strokeWidth={1.8} /> },
  { id: "month", label: "Mes", title: "Agrupar por mes", icon: <Calendar size={16} strokeWidth={1.8} /> },
  { id: "year", label: "Año", title: "Agrupar por año", icon: <CalendarRange size={16} strokeWidth={1.8} /> },
];

const DIRECTION_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "inbound", label: "Entrantes" },
  { value: "outbound", label: "Salientes" },
];

const PRESETS = [
  { id: "30d", label: "30 días", days: 30 },
  { id: "90d", label: "90 días", days: 90 },
  { id: "365d", label: "12 meses", days: 365 },
];

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDate(from), to: isoDate(to) };
}

function periodLabel(period: string, granularity: MessagingGranularity): string {
  if (granularity === "year") return period.slice(0, 4);
  if (granularity === "month") {
    const date = new Date(`${period}T00:00:00Z`);
    return date.toLocaleDateString("es-ES", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  return new Date(`${period}T00:00:00Z`).toLocaleDateString("es-ES", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function money(value: number | null | undefined): string {
  return Number.isFinite(value ?? NaN) ? USD.format(value ?? 0) : "—";
}

function priceRange(flat: boolean, low: number, high: number): string {
  return flat || low === high ? USD.format(low) : `${USD.format(low)}–${USD.format(high)}`;
}

function directionLabel(direction: WhatsAppLogRow["direction"]): string {
  return direction === "inbound" ? "Entrante" : "Saliente";
}

export type MessagingDashboardProps = React.HTMLAttributes<HTMLElement>;

/**
 * Estadísticas > IA y WhatsApp.
 *
 * Two append-only ledgers share one live view:
 *  - ai_usage_logs: every LLM call with provider tokens + USD cost.
 *  - whatsapp_message_logs: inbound/outbound WhatsApp messages.
 * Coordination ids: ai_usage_stats_api_v1, whatsapp_message_logs_v1,
 * global_socket_ai_usage_v1.
 */
export function MessagingDashboard({ className, ...props }: MessagingDashboardProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const initial = useMemo(() => defaultRange(30), []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [granularity, setGranularity] = useState<MessagingGranularity>("month");
  const [ai, setAI] = useState<AIUsagePayload | null>(null);
  const [wa, setWA] = useState<WhatsAppLogPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"" | "inbound" | "outbound">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [aiResult, waResult] = await Promise.all([
        api.analytics.getAIUsage({ from, to, granularity }),
        api.analytics.getWhatsAppMessages({
          from,
          to,
          granularity,
          direction: direction || undefined,
          search: search.trim() || undefined,
          page,
          limit: 50,
        }),
      ]);
      if (!aiResult.success) {
        setError(aiResult.message);
        setAI(null);
      } else {
        setAI(aiResult as AIUsagePayload & { success: true });
      }
      if (!waResult.success) {
        setError(waResult.message);
        setWA(null);
      } else {
        setWA(waResult as WhatsAppLogPayload & { success: true });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error cargando el registro de mensajes");
    } finally {
      setLoading(false);
    }
  }, [api.analytics, direction, from, granularity, page, search, to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: the backend publishes one event per persisted AI call or
  // WhatsApp message. Debounce so a multi-call agent turn triggers one reload.
  const scheduleReload = useCallback(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void load();
    }, 800);
  }, [load]);

  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);

  useGlobalSocketTopic("ai_usage", scheduleReload);
  useGlobalSocketTopic("whatsapp_log", scheduleReload);

  const applyPreset = useCallback((days: number) => {
    const range = defaultRange(days);
    setFrom(range.from);
    setTo(range.to);
    setPage(1);
    setGranularity(days > 180 ? "month" : "week");
  }, []);

  const maxCost = useMemo(() => Math.max(0.0000001, ...(ai?.series ?? []).map((point) => point.costUsd)), [ai]);
  const totalMessages = (wa?.summary.inbound ?? 0) + (wa?.summary.outbound ?? 0);

  return (
    <section
      className={cn("mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-0 pb-4 text-[var(--bo-text)] sm:gap-5 sm:px-6 sm:pb-6 xl:px-8 xl:pb-8", className)}
      data-ui="messaging-dashboard"
      data-testid="messaging-dashboard-root"
      {...props}
    >
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" data-ui="messaging-dashboard-header" data-testid="messaging-dashboard-header">
        <div data-ui="messaging-dashboard-heading" data-testid="messaging-dashboard-heading">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--bo-accent-2)]" data-testid="messaging-dashboard-eyebrow">Observabilidad</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" data-testid="messaging-dashboard-title">IA y WhatsApp</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--bo-muted)] sm:mt-2" data-testid="messaging-dashboard-description">
            Mensajes enviados y recibidos, llamadas de IA, tokens y coste real por modelo. Actualización en vivo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="messaging-dashboard-controls">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              variant="secondary"
              size="sm"
              onClick={() => applyPreset(preset.days)}
              data-testid={`messaging-preset-${preset.id}`}
            >
              {preset.label}
            </Button>
          ))}
          <DateRangePicker
            from={from}
            to={to}
            onChange={({ from: nextFrom, to: nextTo }) => {
              const next = nextFrom && nextTo ? { from: nextFrom, to: nextTo } : defaultRange(30);
              setFrom(next.from);
              setTo(next.to);
              setPage(1);
            }}
            buttonLabel="Rango personalizado"
            ariaLabel="Seleccionar rango de fechas"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            data-testid="messaging-refresh-button"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : undefined} data-testid="messaging-refresh-icon" />
            Actualizar
          </Button>
        </div>
      </header>

      <div className="w-full" data-testid="messaging-granularity-tabs">
        <SimpleTabs
          items={GRANULARITY_TABS}
          activeId={granularity}
          onChange={(value) => setGranularity(value as MessagingGranularity)}
          aria-label="Agrupación temporal"
          className="w-fit"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-[var(--bo-color-danger,#f87171)]/40 bg-[var(--bo-color-danger,#f87171)]/10 px-4 py-3 text-sm" role="alert" data-testid="messaging-error-banner">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="messaging-summary-grid">
        <SummaryCard icon={<Wallet size={16} />} label="Coste IA" value={money(ai?.summary.costUsd)} hint={ai?.summary.unpricedCalls ? `${ai.summary.unpricedCalls} llamadas sin tarifa` : "USD facturado"} testId="messaging-card-ai-cost" />
        <SummaryCard icon={<Activity size={16} />} label="Llamadas IA" value={NUMBER.format(ai?.summary.calls ?? 0)} hint={`${COMPACT.format((ai?.summary.inputTokens ?? 0) + (ai?.summary.outputTokens ?? 0))} tokens`} testId="messaging-card-ai-calls" />
        <SummaryCard icon={<MessageCircle size={16} />} label="Mensajes WhatsApp" value={NUMBER.format(totalMessages)} hint={`${NUMBER.format(wa?.summary.inbound ?? 0)} entrantes`} testId="messaging-card-wa-total" />
        <SummaryCard icon={<Send size={16} />} label="Enviados" value={NUMBER.format(wa?.summary.outbound ?? 0)} hint={`${NUMBER.format(wa?.summary.failed ?? 0)} fallidos`} testId="messaging-card-wa-outbound" />
        <SummaryCard icon={<Bot size={16} />} label="Entrantes" value={NUMBER.format(wa?.summary.inbound ?? 0)} hint="Mensajes recibidos" testId="messaging-card-wa-inbound" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" data-testid="messaging-charts-grid">
        <section className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-testid="messaging-ai-series-panel">
          <div className="mb-3 flex items-center justify-between" data-testid="messaging-ai-series-head">
            <h2 className="text-sm font-semibold" data-testid="messaging-ai-series-title">Coste IA por periodo</h2>
            <span className="text-xs text-[var(--bo-muted)]" data-testid="messaging-ai-series-total">{money(ai?.summary.costUsd)}</span>
          </div>
          {(ai?.series ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--bo-muted)]" data-testid="messaging-ai-series-empty">Sin llamadas en el periodo.</p>
          ) : (
            <div className="flex flex-col gap-2" data-testid="messaging-ai-series-bars">
              {ai?.series.map((point) => (
                <div key={point.period} className="grid grid-cols-[72px_1fr_72px] items-center gap-2" data-testid={`messaging-ai-series-row-${point.period}`}>
                  <span className="truncate text-xs text-[var(--bo-muted)]" data-testid={`messaging-ai-series-label-${point.period}`}>{periodLabel(point.period, granularity)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--bo-surface-2)]" data-testid={`messaging-ai-series-track-${point.period}`}>
                    <span className="block h-full rounded-full bg-[var(--bo-accent)]" style={{ width: `${Math.max(2, (point.costUsd / maxCost) * 100)}%` }} data-testid={`messaging-ai-series-bar-${point.period}`} />
                  </span>
                  <span className="text-right text-xs tabular-nums" data-testid={`messaging-ai-series-value-${point.period}`}>{money(point.costUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-testid="messaging-wa-series-panel">
          <div className="mb-3 flex items-center justify-between" data-testid="messaging-wa-series-head">
            <h2 className="text-sm font-semibold" data-testid="messaging-wa-series-title">Mensajes por periodo</h2>
            <span className="text-xs text-[var(--bo-muted)]" data-testid="messaging-wa-series-total">{NUMBER.format(totalMessages)}</span>
          </div>
          {(wa?.series ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--bo-muted)]" data-testid="messaging-wa-series-empty">Sin mensajes en el periodo.</p>
          ) : (
            <div className="flex flex-col gap-2" data-testid="messaging-wa-series-bars">
              {wa?.series.map((point) => {
                const max = Math.max(1, ...(wa?.series ?? []).map((entry) => entry.total));
                return (
                  <div key={point.period} className="grid grid-cols-[72px_1fr_72px] items-center gap-2" data-testid={`messaging-wa-series-row-${point.period}`}>
                    <span className="truncate text-xs text-[var(--bo-muted)]" data-testid={`messaging-wa-series-label-${point.period}`}>{periodLabel(point.period, granularity)}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-[var(--bo-surface-2)]" data-testid={`messaging-wa-series-track-${point.period}`}>
                      <span className="block h-full rounded-full bg-[var(--bo-accent-2)]" style={{ width: `${Math.max(2, (point.total / max) * 100)}%` }} data-testid={`messaging-wa-series-bar-${point.period}`} />
                    </span>
                    <span className="text-right text-xs tabular-nums" data-testid={`messaging-wa-series-value-${point.period}`}>{point.inbound}/{point.outbound}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" data-testid="messaging-models-panel">
        <div className="border-b border-[var(--bo-border)] px-4 py-3" data-testid="messaging-models-head">
          <h2 className="text-sm font-semibold" data-testid="messaging-models-title">Consumo por modelo y funcionalidad</h2>
        </div>
        <div className="overflow-x-auto" data-testid="messaging-models-scroll">
          <table className="w-full text-left text-xs" data-testid="messaging-models-table">
            <thead className="bg-[var(--bo-surface-2)] text-[var(--bo-muted)]" data-testid="messaging-models-thead">
              <tr data-testid="messaging-models-head-row">
                <th className="px-4 py-2 font-medium" data-testid="messaging-models-th-model">Modelo</th>
                <th className="px-4 py-2 text-right font-medium" data-testid="messaging-models-th-calls">Llamadas</th>
                <th className="px-4 py-2 text-right font-medium" data-testid="messaging-models-th-tokens">Tokens</th>
                <th className="px-4 py-2 text-right font-medium" data-testid="messaging-models-th-cost">Coste</th>
              </tr>
            </thead>
            <tbody data-testid="messaging-models-tbody">
              {(ai?.byModel ?? []).length === 0 ? (
                <tr data-testid="messaging-models-empty-row"><td colSpan={4} className="px-4 py-6 text-center text-[var(--bo-muted)]" data-testid="messaging-models-empty">Sin datos.</td></tr>
              ) : ai?.byModel.map((row) => (
                <tr key={`${row.provider}-${row.model}`} className="border-t border-[var(--bo-border)]" data-testid={`messaging-models-row-${row.provider}-${row.model}`}>
                  <td className="px-4 py-2" data-testid={`messaging-models-model-${row.provider}-${row.model}`}>
                    <span className="font-medium" data-testid={`messaging-models-model-name-${row.provider}-${row.model}`}>{row.model}</span>
                    <span className="ml-1.5 text-[var(--bo-muted)]" data-testid={`messaging-models-model-provider-${row.provider}-${row.model}`}>{row.provider}</span>
                    {!row.priced ? <span className="ml-1.5 rounded bg-[var(--bo-color-warning,#fbbf24)]/15 px-1.5 py-0.5 text-[10px] text-[var(--bo-color-warning,#fbbf24)]" data-testid={`messaging-models-unpriced-${row.provider}-${row.model}`}>sin tarifa</span> : null}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums" data-testid={`messaging-models-calls-${row.provider}-${row.model}`}>{NUMBER.format(row.calls)}</td>
                  <td className="px-4 py-2 text-right tabular-nums" data-testid={`messaging-models-tokens-${row.provider}-${row.model}`}>{COMPACT.format(row.inputTokens + row.outputTokens)}</td>
                  <td className="px-4 py-2 text-right tabular-nums" data-testid={`messaging-models-cost-${row.provider}-${row.model}`}>{money(row.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--bo-border)] px-4 py-3" data-testid="messaging-features-strip">
          <div className="flex flex-wrap gap-2" data-testid="messaging-features-list">
            {(ai?.byFeature ?? []).map((row) => (
              <span key={row.feature} className="rounded-lg border border-[var(--bo-border)] px-2 py-1 text-[11px]" data-testid={`messaging-feature-chip-${row.feature}`}>
                {featureLabel(row.feature)} · {NUMBER.format(row.calls)} · {money(row.costUsd)}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" data-testid="messaging-wa-panel">
        <div className="flex flex-col gap-2 border-b border-[var(--bo-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="messaging-wa-head">
          <h2 className="text-sm font-semibold" data-testid="messaging-wa-title">Registro de mensajes WhatsApp</h2>
          <div className="flex flex-wrap items-center gap-2" data-testid="messaging-wa-filters">
            <Select
              value={direction}
              onChange={(value) => { setDirection(value as "" | "inbound" | "outbound"); setPage(1); }}
              options={DIRECTION_OPTIONS}
              size="sm"
              ariaLabel="Dirección"
              data-testid="messaging-wa-direction-select"
            />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Teléfono o texto"
              className="bo-input w-44"
              aria-label="Buscar"
              data-testid="messaging-wa-search-input"
            />
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto" data-testid="messaging-wa-scroll">
          <table className="w-full text-left text-xs" data-testid="messaging-wa-table">
            <thead className="sticky top-0 bg-[var(--bo-surface-2)] text-[var(--bo-muted)]" data-testid="messaging-wa-thead">
              <tr data-testid="messaging-wa-head-row">
                <th className="px-4 py-2 font-medium" data-testid="messaging-wa-th-date">Fecha</th>
                <th className="px-4 py-2 font-medium" data-testid="messaging-wa-th-direction">Dirección</th>
                <th className="px-4 py-2 font-medium" data-testid="messaging-wa-th-phone">Teléfono</th>
                <th className="px-4 py-2 font-medium" data-testid="messaging-wa-th-content">Mensaje</th>
                <th className="px-4 py-2 font-medium" data-testid="messaging-wa-th-source">Origen</th>
              </tr>
            </thead>
            <tbody data-testid="messaging-wa-tbody">
              {(wa?.logs ?? []).length === 0 ? (
                <tr data-testid="messaging-wa-empty-row"><td colSpan={5} className="px-4 py-6 text-center text-[var(--bo-muted)]" data-testid="messaging-wa-empty">Sin mensajes en el periodo.</td></tr>
              ) : wa?.logs.map((row) => (
                <tr key={row.id} className="border-t border-[var(--bo-border)] align-top" data-testid={`messaging-wa-row-${row.id}`}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-[var(--bo-muted)]" data-testid={`messaging-wa-date-${row.id}`}>{formatDateTime(row.createdAt)}</td>
                  <td className="px-4 py-2" data-testid={`messaging-wa-direction-${row.id}`}>
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium", row.direction === "inbound" ? "bg-[var(--bo-accent-2)]/15 text-[var(--bo-accent-2)]" : "bg-[var(--bo-accent)]/15 text-[var(--bo-accent)]")} data-testid={`messaging-wa-direction-badge-${row.id}`}>
                      {directionLabel(row.direction)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px]" data-testid={`messaging-wa-phone-${row.id}`}>{row.userPhone || "—"}</td>
                  <td className="max-w-[520px] px-4 py-2" data-testid={`messaging-wa-content-${row.id}`}>
                    <span className="line-clamp-2 block whitespace-pre-wrap" data-testid={`messaging-wa-content-text-${row.id}`}>{row.content}</span>
                  </td>
                  <td className="px-4 py-2 text-[var(--bo-muted)]" data-testid={`messaging-wa-source-${row.id}`}>{row.source || row.messageType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--bo-border)] px-4 py-2" data-testid="messaging-wa-pagination">
          <span className="text-[11px] text-[var(--bo-muted)]" data-testid="messaging-wa-page-label">Página {wa?.page ?? page}</span>
          <div className="flex gap-1" data-testid="messaging-wa-page-buttons">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior" data-testid="messaging-wa-prev-page">
              <ChevronLeft size={14} data-testid="messaging-wa-prev-icon" />
            </Button>
            <Button variant="secondary" size="sm" disabled={!wa?.hasMore} onClick={() => setPage((value) => value + 1)} aria-label="Página siguiente" data-testid="messaging-wa-next-page">
              <ChevronRight size={14} data-testid="messaging-wa-next-icon" />
            </Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)]" data-testid="messaging-pricing-panel">
        <div className="border-b border-[var(--bo-border)] px-4 py-3" data-testid="messaging-pricing-head">
          <h2 className="text-sm font-semibold" data-testid="messaging-pricing-title">Tarifas aplicadas (USD / 1M tokens)</h2>
          <p className="mt-0.5 text-[11px] text-[var(--bo-muted)]" data-testid="messaging-pricing-note">
            MiniMax-M3.1-Flash: tarifa plana ($0.15/1M entrada, $0.60/1M salida, $0.015/1M caché leída).
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2" data-testid="messaging-pricing-grid">
          {(ai?.pricing ?? []).map((entry) => (
            <div key={`${entry.provider}-${entry.model}`} className="rounded-lg border border-[var(--bo-border)] p-3" data-testid={`messaging-pricing-card-${entry.provider}-${entry.model}`}>
              <p className="text-xs font-semibold" data-testid={`messaging-pricing-model-${entry.provider}-${entry.model}`}>{entry.model}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]" data-testid={`messaging-pricing-values-${entry.provider}-${entry.model}`}>
                <div data-testid={`messaging-pricing-input-wrap-${entry.provider}-${entry.model}`}>
                  <dt className="text-[var(--bo-muted)]" data-testid={`messaging-pricing-input-label-${entry.provider}-${entry.model}`}>Input</dt>
                  <dd className="tabular-nums" data-testid={`messaging-pricing-input-value-${entry.provider}-${entry.model}`}>{priceRange(entry.flat, entry.offPeak.inputUsdPerMillion, entry.peak.inputUsdPerMillion)}</dd>
                </div>
                <div data-testid={`messaging-pricing-output-wrap-${entry.provider}-${entry.model}`}>
                  <dt className="text-[var(--bo-muted)]" data-testid={`messaging-pricing-output-label-${entry.provider}-${entry.model}`}>Output</dt>
                  <dd className="tabular-nums" data-testid={`messaging-pricing-output-value-${entry.provider}-${entry.model}`}>{priceRange(entry.flat, entry.offPeak.outputUsdPerMillion, entry.peak.outputUsdPerMillion)}</dd>
                </div>
                <div data-testid={`messaging-pricing-cache-wrap-${entry.provider}-${entry.model}`}>
                  <dt className="text-[var(--bo-muted)]" data-testid={`messaging-pricing-cache-label-${entry.provider}-${entry.model}`}>Cache read</dt>
                  <dd className="tabular-nums" data-testid={`messaging-pricing-cache-value-${entry.provider}-${entry.model}`}>{priceRange(entry.flat, entry.offPeak.cacheReadUsdPerMillion, entry.peak.cacheReadUsdPerMillion)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}

function SummaryCard({ icon, label, value, hint, testId }: { icon: React.ReactNode; label: string; value: string; hint: string; testId: string }) {
  return (
    <div className="rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] p-4" data-testid={`${testId}-card`}>
      <div className="flex items-center gap-2 text-[var(--bo-muted)]" data-testid={`${testId}-label-row`}>
        <span data-testid={`${testId}-icon`}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide" data-testid={`${testId}-label`}>{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums" data-testid={`${testId}-value`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[var(--bo-muted)]" data-testid={`${testId}-hint`}>{hint}</p>
    </div>
  );
}

function featureLabel(feature: string): string {
  const labels: Record<string, string> = {
    forky_assistant: "Forky",
    whatsapp_bot: "Bot WhatsApp",
    translation: "Traducciones",
    stock_ai: "Stock IA",
    stock_ocr: "OCR stock",
  };
  return labels[feature] ?? feature;
}

export default MessagingDashboard;
