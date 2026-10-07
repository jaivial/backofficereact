import React from "react";

import type { POSQueuedRequest } from "../../utils/offlineQueue";

/** "hace 3 min" for a queued write, so a waiter can see how stale it is. */
function agoLabel(queuedAt: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - queuedAt) / 1000));
  if (seconds < 60) return "ahora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `hace ${hours} h`;
}

/**
 * The offline strip at the top of the sell screen.
 *
 * It has to answer three questions without the waiter asking: am I connected,
 * how much of the table is still only on this tablet, and is anything stuck.
 * So it names the count, ages the oldest entry, marks retries, and offers the
 * one action that can help — send now.
 */
export function POSOfflineBar({ online, entries, notice, syncing, onSync }: { online: boolean; entries: POSQueuedRequest[]; notice?: string; syncing?: boolean; onSync: () => void }) {
  const offline = !online;
  const pending = entries.length;
  if (!offline && pending === 0 && !notice) return null;

  const oldest = entries.reduce<POSQueuedRequest | null>((min, entry) => (!min || entry.queuedAt < min.queuedAt ? entry : min), null);
  const stuck = entries.filter((entry) => entry.attempts > 0);
  const state = offline ? "offline" : pending > 0 ? "syncing" : "restored";

  const label = offline
    ? pending > 0 ? `Sin conexión · ${pending} ${pending === 1 ? "línea guardada" : "líneas guardadas"}` : "Sin conexión"
    : pending > 0 ? `Enviando ${pending}…` : "Conexión recuperada";

  const detail = offline && pending > 0 && oldest
    ? `La más antigua ${agoLabel(oldest.queuedAt, Date.now())}. Se enviará sola al volver la red.`
    : offline
      ? "Puedes seguir anotando la comanda; el cobro necesita conexión."
      : pending > 0
        ? "Las líneas guardadas se están enviando al TPV."
        : notice || "Todo enviado al TPV.";

  return (
    <div className={`pos-offline pos-offline--${state}`} role="status" aria-live="polite" data-ui={`pos-offline-bar-${state}`} data-testid="pos-offline-bar" data-state={state} data-pending={pending}>
      <span className="pos-offline__dot" aria-hidden="true" />
      <div className="pos-offline__text">
        <strong className="pos-offline__title" data-testid="pos-offline-title">{label}</strong>
        <span className="pos-offline__detail" data-testid="pos-offline-detail">{detail}</span>
      </div>
      {stuck.length > 0 ? <span className="pos-offline__stuck" data-testid="pos-offline-stuck">{stuck.length} sin enviar</span> : null}
      {pending > 0 && online ? (
        <button type="button" className="pos-offline__action" onClick={onSync} disabled={syncing} data-ui="pos-offline-sync" data-testid="pos-offline-sync">
          {syncing ? "Enviando…" : "Enviar ahora"}
        </button>
      ) : null}
    </div>
  );
}
