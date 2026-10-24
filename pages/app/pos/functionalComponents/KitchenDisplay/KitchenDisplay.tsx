import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChefHat, Clock, RefreshCw, ShoppingBag, Users } from "lucide-react";

import "../../../../../components/styles/features/pos/kitchen-display.css";

type KitchenLine = { id: number; productName: string; quantity: number; action: "ADD" | "VOID" | "NOTE" | "FIRE"; notes?: string };
type KitchenDispatch = {
  id: number;
  stationId: number;
  stationName?: string;
  ticketNumber: string;
  tableName?: string;
  status: string;
  createdAt: string;
  lines: KitchenLine[];
  /** Coordination id: pos_kds_context_v1 */
  covers?: number;
  channel?: string;
  ticketNote?: string;
  course?: string;
};

const POLL_MS = 5000;
/** Minutes after which a pending/accepted ticket turns amber, then red. */
const WARN_MIN = 10;
const LATE_MIN = 20;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers); headers.set("Content-Type", "application/json");
  const response = await fetch(`/api/admin/pos${path}`, { ...init, credentials: "include", headers });
  const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.message || "Error KDS"); return body as T;
}

function ageMinutes(iso: string, now: number): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

function channelLabel(dispatch: KitchenDispatch): string {
  if (dispatch.tableName) return `Mesa ${dispatch.tableName}`;
  if (dispatch.channel === "TAKEAWAY") return "Para llevar";
  if (dispatch.channel === "BAR") return "Barra";
  return "Sin mesa";
}

const STATUS_LABEL: Record<string, string> = { PENDING: "Nueva", ACKNOWLEDGED: "En marcha", READY: "Lista" };

/**
 * Kitchen display: one card per dispatch, grouped by station. A cook needs
 * four things at a glance — how long it has been waiting, for how many, which
 * course, and what is special about each plate — so those lead the card.
 * Coordination id: pos_kds_context_v1
 */
export function KitchenDisplay() {
  const [items, setItems] = useState<KitchenDispatch[]>([]);
  const [error, setError] = useState("");
  const [showReady, setShowReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Latest-wins: the poll can land after a manual update and re-show a ticket
  // the cook just completed, so only the newest request may write state.
  const seqRef = useRef(0);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const data = await request<{ items: KitchenDispatch[] }>("/kitchen/queue");
      if (seq !== seqRef.current) return;
      const next = data.items || [];
      // Highlight dispatches that were not on screen before this poll.
      const fresh = new Set<number>();
      if (knownIdsRef.current.size) for (const item of next) if (!knownIdsRef.current.has(item.id)) fresh.add(item.id);
      knownIdsRef.current = new Set(next.map((item) => item.id));
      if (fresh.size) { setFreshIds(fresh); window.setTimeout(() => setFreshIds(new Set()), 6000); }
      setItems(next);
      setError("");
    } catch (reason) {
      if (seq !== seqRef.current) return;
      setError(reason instanceof Error ? reason.message : "No se pudo cargar cocina");
    }
  }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), POLL_MS); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);

  const visible = useMemo(() => items.filter((item) => showReady || item.status !== "READY"), [items, showReady]);
  const grouped = useMemo(() => visible.reduce<Record<string, KitchenDispatch[]>>((out, item) => { const key = item.stationName || "Cocina"; (out[key] ||= []).push(item); return out; }, {}), [visible]);
  const pendingCount = useMemo(() => items.filter((item) => item.status !== "READY").length, [items]);
  const readyCount = items.length - pendingCount;

  const update = useCallback(async (id: number, status: string) => {
    ++seqRef.current;
    try { await request(`/kitchen/dispatches/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo actualizar cocina"); }
  }, [load]);

  return (
    <section className="kds" data-ui="kds-root" data-testid="kds-root">
      <header className="kds__header" data-ui="kds-header">
        <div data-ui="kds-heading">
          <h2 className="kds__title" data-ui="kds-title"><ChefHat className="h-5 w-5" aria-hidden="true" /> Cocina</h2>
          <p className="kds__subtitle" data-ui="kds-subtitle" aria-live="polite" data-testid="kds-counts">
            {pendingCount} {pendingCount === 1 ? "comanda pendiente" : "comandas pendientes"}{readyCount ? ` · ${readyCount} ${readyCount === 1 ? "lista" : "listas"}` : ""}
          </p>
        </div>
        <div className="kds__tools">
          <button type="button" className={`kds__toggle${showReady ? " is-on" : ""}`} aria-pressed={showReady} onClick={() => setShowReady((v) => !v)} data-testid="kds-toggle-ready">
            {showReady ? "Ocultar listas" : "Ver listas"}
          </button>
          <button className="kds__refresh" type="button" onClick={() => void load()} aria-label="Actualizar cocina" title="Actualizar" data-ui="kds-refresh" data-testid="kds-refresh">
            <RefreshCw className="h-4 w-4" aria-hidden="true" data-ui="kds-refresh-icon" />
          </button>
        </div>
      </header>
      {error ? <p className="kds__error" role="alert" data-ui="kds-error" data-testid="kds-error">{error}</p> : null}
      {Object.entries(grouped).map(([station, dispatches]) => (
        <section className="kds__station" key={station} data-ui="kds-station" data-testid={`kds-station-${station}`}>
          <h3 className="kds__stationTitle" data-ui="kds-station-title">{station} <span className="kds__stationCount" data-testid="kds-station-count">{dispatches.length}</span></h3>
          <div className="kds__grid" data-ui="kds-station-grid">
            {dispatches.map((dispatch) => {
              const minutes = ageMinutes(dispatch.createdAt, now);
              const urgency = dispatch.status === "READY" ? "ready" : minutes >= LATE_MIN ? "late" : minutes >= WARN_MIN ? "warn" : "ok";
              const hasVoid = dispatch.lines.some((line) => line.action === "VOID");
              return (
                <article
                  className={`kds__card is-${urgency}${freshIds.has(dispatch.id) ? " is-fresh" : ""}${hasVoid ? " has-void" : ""}`}
                  key={dispatch.id}
                  data-ui="kds-ticket"
                  data-testid={`kds-ticket-${dispatch.id}`}
                  aria-label={`${channelLabel(dispatch)}, ${dispatch.covers ?? 0} comensales, curso ${dispatch.course || "1"}, ${minutes} minutos, ${STATUS_LABEL[dispatch.status] || dispatch.status}`}
                >
                  <header className="kds__cardHead" data-ui="kds-ticket-header">
                    <div className="kds__where" data-ui="kds-ticket-heading">
                      <strong className="kds__table" data-ui="kds-table" data-testid={`kds-table-${dispatch.id}`}>
                        {dispatch.channel === "TAKEAWAY" && !dispatch.tableName ? <ShoppingBag className="h-4 w-4" aria-hidden="true" /> : null}
                        {channelLabel(dispatch)}
                      </strong>
                      <span className="kds__meta" data-ui="kds-ticket-number">
                        <span className="kds__covers" title="Comensales" data-testid={`kds-covers-${dispatch.id}`}><Users className="h-3.5 w-3.5" aria-hidden="true" />{dispatch.covers ?? 0}</span>
                        <span className="kds__course" title="Curso" data-testid={`kds-course-${dispatch.id}`}>{dispatch.course && dispatch.course !== "1" ? `${dispatch.course}º` : "1º"}</span>
                        <span className="kds__number">{dispatch.ticketNumber}</span>
                      </span>
                    </div>
                    <div className="kds__right">
                      <span className={`kds__age is-${urgency}`} data-testid={`kds-age-${dispatch.id}`}><Clock className="h-3.5 w-3.5" aria-hidden="true" />{minutes} min</span>
                      <span className={`kds__status is-${dispatch.status.toLowerCase()}`} data-ui="kds-status" data-testid={`kds-status-${dispatch.id}`}>{STATUS_LABEL[dispatch.status] || dispatch.status}</span>
                    </div>
                  </header>
                  {dispatch.ticketNote ? <p className="kds__ticketNote" data-testid={`kds-ticket-note-${dispatch.id}`}><AlertTriangle className="h-4 w-4" aria-hidden="true" />{dispatch.ticketNote}</p> : null}
                  <ul className="kds__lines" data-ui="kds-lines">
                    {dispatch.lines.map((line) => (
                      <li className={`kds__line is-${line.action.toLowerCase()}`} key={line.id} data-ui="kds-line" data-testid={`kds-line-${line.id}`}>
                        <span className="kds__qty" data-ui="kds-line-qty">{Math.abs(line.quantity)}×</span>
                        <span className="kds__lineBody">
                          <strong className="kds__lineName" data-ui="kds-line-name">{line.productName}</strong>
                          {line.notes ? <span className="kds__lineNotes" data-ui="kds-line-notes">{line.notes}</span> : null}
                        </span>
                        {line.action === "VOID" ? <span className="kds__lineTag is-void" data-ui="kds-line-action">ANULADO</span> : null}
                      </li>
                    ))}
                  </ul>
                  <div className="kds__actions" data-ui="kds-actions">
                    {dispatch.status === "PENDING" ? (
                      <button className="kds__btn" type="button" onClick={() => void update(dispatch.id, "ACKNOWLEDGED")} data-testid={`kds-ack-${dispatch.id}`}>En marcha</button>
                    ) : null}
                    {dispatch.status !== "READY" ? (
                      <button className="kds__btn kds__btn--primary" type="button" onClick={() => void update(dispatch.id, "READY")} data-testid={`kds-ready-${dispatch.id}`}><Check className="h-4 w-4" aria-hidden="true" /> Lista</button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!visible.length && !error ? (
        <p className="kds__empty" data-ui="kds-empty" data-testid="kds-empty">{items.length ? "Todo listo. Sin comandas pendientes." : "Sin comandas pendientes."}</p>
      ) : null}
    </section>
  );
}
