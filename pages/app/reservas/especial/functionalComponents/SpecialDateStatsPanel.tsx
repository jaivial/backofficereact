import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarCheck, CreditCard, UtensilsCrossed, Users, Wallet } from "lucide-react";

import { createClient } from "../../../../../api/client";
import { SPECIAL_DATE_PAYMENT_METHOD_LABELS, type SpecialDatePaymentMethod, type SpecialDateStats } from "../../../../../api/types";
import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { useGlobalSocketTopic } from "../../../../../ui/realtime/GlobalSocketProvider";

const eurFmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const eur = (n: number) => eurFmt.format(Number(n || 0));
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/**
 * Statistics of one special date: KPIs (people, bookings, adelanto paid),
 * menus with nested principales as proportion bars, and adelanto split by
 * payment method. Live: refetches (debounced) on the global socket "booking"
 * topic; only the first paint is staggered so live updates never re-animate.
 * Coordination id: special_date_stats_v1
 */
export function SpecialDateStatsPanel({ date }: { date: string }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [stats, setStats] = useState<SpecialDateStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    const res = await api.config.getSpecialDateStats(date);
    if (!res.success) { setError(res.message || "No se pudieron cargar las estadísticas"); return; }
    setError(null);
    setStats(res.stats);
  }, [api, date]);

  useEffect(() => { void load(); }, [load]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const onBooking = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void load(); }, 500);
  }, [load]);
  useGlobalSocketTopic("booking", onBooking);

  if (error) return <InlineAlert kind="error" title="Estadísticas" message={error} testId="especial-stats-error" />;
  if (!stats) return <StatsSkeleton />;

  const totalMenus = stats.menus.reduce((acc, m) => acc + m.count, 0);
  const avgParty = stats.bookings > 0 ? (stats.people / stats.bookings).toFixed(1).replace(".", ",") : "0";
  const chunk = (i: number) => (reduceMotion
    ? {}
    : { initial: { opacity: 0, transform: "translateY(8px)" }, animate: { opacity: 1, transform: "translateY(0px)" }, transition: { duration: 0.3, ease: "easeOut" as const, delay: i * 0.1 } });

  return (
    <section className="bo-sdStats" data-testid="especial-stats" aria-label="Estadísticas de la fecha especial">
      <motion.div className="bo-sdStatsKpis" data-slot="especial-stats-kpis" {...chunk(0)}>
        <Kpi icon={<Users size={18} strokeWidth={1.5} aria-hidden="true" />} label="Personas" value={String(stats.people)} hint={`${avgParty} por reserva`} testId="especial-stats-people" />
        <Kpi icon={<CalendarCheck size={18} strokeWidth={1.5} aria-hidden="true" />} label="Reservas" value={String(stats.bookings)} hint={`${totalMenus} menús`} testId="especial-stats-bookings" />
        <Kpi icon={<Wallet size={18} strokeWidth={1.5} aria-hidden="true" />} label="Adelanto pagado" value={eur(stats.adelanto_paid_total)} hint={`${stats.adelanto_by_method.length} ${stats.adelanto_by_method.length === 1 ? "método" : "métodos"}`} tone="success" testId="especial-stats-adelanto-total" />
      </motion.div>

      <motion.div className="bo-sdStatsCard" data-testid="especial-stats-menus" {...chunk(1)}>
        <CardHead icon={<UtensilsCrossed size={16} strokeWidth={1.5} aria-hidden="true" />} title="Menús y principales" meta={`${totalMenus} en total`} testId="especial-stats-menus-head" />
        {stats.menus.length === 0 ? (
          <Empty text="Todavía no hay menús reservados." testId="especial-stats-menus-empty" />
        ) : (
          <ul className="bo-sdStatsMenus" data-slot="especial-stats-menus-list">
            {stats.menus.map((m, i) => (
              <li key={m.label} className="bo-sdStatsMenu" data-testid={`especial-stats-menu-${i}`}>
                <Bar label={m.label} value={m.count} share={pct(m.count, totalMenus)} strong testId={`especial-stats-menu-${i}-bar`} />
                {m.principales.length > 0 ? (
                  <ul className="bo-sdStatsDishes" aria-label={`Principales de ${m.label}`} data-slot="especial-stats-menu-principales">
                    {m.principales.map((d, j) => (
                      <li key={d.name} data-testid={`especial-stats-menu-${i}-dish-${j}`}>
                        <Bar label={d.name} value={d.count} share={pct(d.count, m.count)} testId={`especial-stats-menu-${i}-dish-${j}-bar`} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      <motion.div className="bo-sdStatsCard" data-testid="especial-stats-methods" {...chunk(2)}>
        <CardHead icon={<CreditCard size={16} strokeWidth={1.5} aria-hidden="true" />} title="Adelantos por método de pago" meta={eur(stats.adelanto_paid_total)} testId="especial-stats-methods-head" />
        {stats.adelanto_by_method.length === 0 ? (
          <Empty text="Sin adelantos pagados todavía." testId="especial-stats-methods-empty" />
        ) : (
          <ul className="bo-sdStatsMethods" data-slot="especial-stats-methods-list">
            {stats.adelanto_by_method.map((m) => (
              <li key={m.method} data-testid={`especial-stats-method-${m.method}`}>
                <Bar
                  label={SPECIAL_DATE_PAYMENT_METHOD_LABELS[m.method as SpecialDatePaymentMethod] || m.method}
                  value={eur(m.amount)}
                  share={pct(m.amount, stats.adelanto_paid_total)}
                  strong
                  testId={`especial-stats-method-${m.method}-bar`}
                />
              </li>
            ))}
          </ul>
        )}
      </motion.div>
    </section>
  );
}

function Kpi({ icon, label, value, hint, tone, testId }: { icon: React.ReactNode; label: string; value: string; hint: string; tone?: "success"; testId: string }) {
  return (
    <div className={`bo-sdStatsKpi${tone ? ` is-${tone}` : ""}`} data-testid={testId}>
      <span className="bo-sdStatsKpiIcon" data-slot="especial-stats-kpi-icon">{icon}</span>
      <span className="bo-sdStatsKpiLabel" data-slot="especial-stats-kpi-label">{label}</span>
      <span className="bo-sdStatsKpiValue" data-slot="especial-stats-kpi-value">{value}</span>
      <span className="bo-sdStatsKpiHint" data-slot="especial-stats-kpi-hint">{hint}</span>
    </div>
  );
}

function CardHead({ icon, title, meta, testId }: { icon: React.ReactNode; title: string; meta: string; testId: string }) {
  return (
    <div className="bo-sdStatsCardHead" data-testid={testId}>
      <span className="bo-sdStatsCardTitle" data-slot="especial-stats-card-title">{icon}{title}</span>
      <span className="bo-sdStatsCardMeta" data-slot="especial-stats-card-meta">{meta}</span>
    </div>
  );
}

/** Label + value row over a proportion track; share is also read out. */
function Bar({ label, value, share, strong, testId }: { label: string; value: number | string; share: number; strong?: boolean; testId: string }) {
  return (
    <div className={`bo-sdStatsBar${strong ? " is-strong" : ""}`} data-testid={testId}>
      <div className="bo-sdStatsBarRow" data-slot="especial-stats-bar-row">
        <span className="bo-sdStatsBarLabel" title={label} data-slot="especial-stats-bar-label">{label}</span>
        <span className="bo-sdStatsBarValue" data-slot="especial-stats-bar-value">
          {typeof value === "number" ? `×${value}` : value}
          <span className="bo-sdStatsBarShare" data-slot="especial-stats-bar-share">{share}%</span>
        </span>
      </div>
      <div className="bo-sdStatsTrack" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} data-slot="especial-stats-bar-track">
        <span className="bo-sdStatsFill" style={{ width: `${share}%` }} data-slot="especial-stats-bar-fill" />
      </div>
    </div>
  );
}

function Empty({ text, testId }: { text: string; testId: string }) {
  return <p className="bo-sdStatsEmpty" data-testid={testId}>{text}</p>;
}

function StatsSkeleton() {
  return (
    <section className="bo-sdStats" aria-busy="true" aria-label="Cargando estadísticas" data-testid="especial-stats-loading">
      <div className="bo-sdStatsKpis" data-slot="especial-stats-skeleton-kpis">
        {[0, 1, 2].map((i) => <div key={i} className="bo-sdStatsKpi is-skeleton" data-testid={`especial-stats-skeleton-kpi-${i}`} />)}
      </div>
      <div className="bo-sdStatsCard is-skeleton" data-testid="especial-stats-skeleton-card" />
    </section>
  );
}
