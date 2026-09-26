import React, { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../../../../api/client";
import { SPECIAL_DATE_PAYMENT_METHOD_LABELS, type SpecialDatePaymentMethod, type SpecialDateStats } from "../../../../../api/types";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { Panel } from "../../../../../ui/shell/Panel";
import { useGlobalSocketTopic } from "../../../../../ui/realtime/GlobalSocketProvider";

const eur = (n: number) => `${Number(n || 0).toFixed(2)}€`;

/**
 * Statistics of one special date: people + bookings, menus with nested
 * principales counts, adelanto paid total split by payment method. Refreshes
 * when any booking changes (global socket "booking" topic).
 * Coordination id: special_date_stats_v1
 */
export function SpecialDateStatsPanel({ date }: { date: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [stats, setStats] = useState<SpecialDateStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await api.config.getSpecialDateStats(date);
    if (!res.success) { setError(res.message || "No se pudieron cargar las estadísticas"); return; }
    setError(null);
    setStats(res.stats);
  }, [api, date]);

  useEffect(() => { void load(); }, [load]);
  useGlobalSocketTopic("booking", () => { void load(); });

  if (error) return <InlineAlert kind="error" title="Estadísticas" message={error} testId="especial-stats-error" />;
  if (!stats) return <p className="bo-muted text-center" data-testid="especial-stats-loading">Cargando estadísticas…</p>;

  return (
    <section className="bo-specialStats" data-testid="especial-stats" aria-label="Estadísticas de la fecha especial">
      <div className="bo-specialStatsKpis" data-slot="especial-stats-kpis">
        <Kpi label="Personas" value={String(stats.people)} testId="especial-stats-people" />
        <Kpi label="Reservas" value={String(stats.bookings)} testId="especial-stats-bookings" />
        <Kpi label="Adelanto pagado" value={eur(stats.adelanto_paid_total)} testId="especial-stats-adelanto-total" />
      </div>
      <Panel title="Menús" data-testid="especial-stats-menus">
        {stats.menus.length === 0 ? (
          <p className="bo-muted" data-testid="especial-stats-menus-empty">Sin menús reservados.</p>
        ) : (
          <ul className="bo-specialStatsList" data-slot="especial-stats-menus-list">
            {stats.menus.map((m, i) => (
              <li key={m.label} data-testid={`especial-stats-menu-${i}`}>
                <strong>{m.label}</strong> x{m.count}
                {m.principales.length > 0 ? (
                  <ul data-slot="especial-stats-menu-principales">
                    {m.principales.map((d, j) => (
                      <li key={d.name} data-testid={`especial-stats-menu-${i}-dish-${j}`}>{d.name} x{d.count}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="Adelantos por método de pago" data-testid="especial-stats-methods">
        {stats.adelanto_by_method.length === 0 ? (
          <p className="bo-muted" data-testid="especial-stats-methods-empty">Sin adelantos pagados.</p>
        ) : (
          <ul className="bo-specialStatsList" data-slot="especial-stats-methods-list">
            {stats.adelanto_by_method.map((m) => (
              <li key={m.method} data-testid={`especial-stats-method-${m.method}`}>
                {SPECIAL_DATE_PAYMENT_METHOD_LABELS[m.method as SpecialDatePaymentMethod] || m.method}: <strong>{eur(m.amount)}</strong>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </section>
  );
}

function Kpi({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="bo-specialStatsKpi" data-testid={testId}>
      <div className="bo-muted" data-slot="especial-stats-kpi-label">{label}</div>
      <div className="bo-specialStatsKpiValue" data-slot="especial-stats-kpi-value">{value}</div>
    </div>
  );
}
