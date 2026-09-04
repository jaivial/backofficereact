import React, { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";

import type { POSCashDay } from "../../../../../api/types";
import { formatSpanishLongDate } from "./POSNoCashDayModal";
import { POSForceOpenConfirmModal } from "./POSForceOpenConfirmModal";

/** RFC3339 openedAt → "08:30". Falls back to "—" so a missing time never reads as 00:00. */
function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function euros(cents: number | undefined): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents ?? 0) / 100);
}

export type POSUnclosedDaysModalProps = {
  date: string;
  unclosedPrevious: POSCashDay[];
  error?: string;
  onOpenDay: (openingCashCents: number, force?: boolean) => Promise<boolean>;
  onPickDate: (iso: string) => void;
};

/**
 * Gate shown when the selected business date has no till AND earlier days are
 * still unsealed. Priority over `POSNoCashDayModal`: opening today while
 * yesterday's till is open is the path the `force` flag exists for, and the
 * backend already refuses the plain open with 409 UNCLOSED_PREVIOUS_DAYS.
 *
 * Non-dismissable by construction: `pos.tsx` renders this whenever
 * `cashDay === null && unclosedPrevious.length > 0`, so closing it would only
 * re-render it. "Ver día" jumps `?date=` to the unsealed day (so it can be
 * closed from its own gate); "Abrir día igualmente" force-opens today.
 */
export function POSUnclosedDaysModal({ date, unclosedPrevious, error, onOpenDay, onPickDate }: POSUnclosedDaysModalProps) {
  const [confirmForce, setConfirmForce] = useState(false);
  const [busy, setBusy] = useState(false);

  const forceOpen = async () => {
    setBusy(true);
    try {
      // No float is collected in this flow: an empty float opens with 0, the
      // same default `POSNoCashDayModal` uses for a blank field.
      await onOpenDay(0, true);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <>
      <div className="pos-unclosedModal__overlay" data-testid="pos-unclosed-modal-overlay">
        <div className="pos-unclosedModal" role="alertdialog" aria-labelledby="pos-unclosed-title" aria-describedby="pos-unclosed-desc" data-testid="pos-unclosed-modal">
          <header data-testid="pos-unclosedmodal-header" className="pos-unclosedModal__header">
            <AlertTriangle size={32} className="pos-unclosedModal__icon" />
            <h2 data-slot="pOSUnclosedDaysModal-pos-unclosedModal-title" id="pos-unclosed-title" className="pos-unclosedModal__title">Días anteriores sin cerrar</h2>
            <p data-slot="pOSUnclosedDaysModal-pos-unclosedModal-desc" id="pos-unclosed-desc" className="pos-unclosedModal__desc">
              Cierra estos días antes de abrir el {formatSpanishLongDate(date)}, o ábrelo igualmente.
            </p>
          </header>
          <div className="pos-unclosedModal__list" data-testid="pos-unclosed-list">
            {unclosedPrevious.map((day) => (
              <article key={day.id} className="pos-unclosedCard" data-testid="pos-unclosed-card">
                <div data-slot="pOSUnclosedDaysModal-pos-unclosedCard-date" className="pos-unclosedCard__date">{formatSpanishLongDate(day.date)}</div>
                <dl className="pos-unclosedCard__meta">
                  <div data-slot="pOSUnclosedDaysModal-pos-unclosedCard-field" className="pos-unclosedCard__field">
                    <dt>Apertura</dt>
                    <dd>{formatTime(day.openedAt)}</dd>
                  </div>
                  <div data-slot="pOSUnclosedDaysModal-pos-unclosedCard-field" className="pos-unclosedCard__field">
                    <dt>Usuario</dt>
                    <dd>{day.openedByName || "—"}</dd>
                  </div>
                  <div data-slot="pOSUnclosedDaysModal-pos-unclosedCard-field" className="pos-unclosedCard__field">
                    <dt>Facturación</dt>
                    <dd>{euros(day.totalGrossCents)}</dd>
                  </div>
                  <div data-slot="pOSUnclosedDaysModal-pos-unclosedCard-field" className="pos-unclosedCard__field">
                    <dt>Afluencia</dt>
                    <dd>{day.covers ?? 0}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="pos-unclosedCard__view"
                  onClick={() => onPickDate(day.date)}
                  data-testid="pos-unclosed-view-day"
                >
                  Ver día
                </button>
              </article>
            ))}
          </div>
          {error ? <p className="pos-unclosedModal__error" role="alert" data-testid="pos-unclosed-error">{error}</p> : null}
          <div data-slot="pOSUnclosedDaysModal-pos-unclosedModal-actions" className="pos-unclosedModal__actions">
            <a href="/app/pos?section=reports" className="pos-unclosedModal__link" data-testid="pos-unclosed-go-reports">
              Ir a Informes
            </a>
            <button
              type="button"
              className="pos-unclosedModal__force"
              onClick={() => setConfirmForce(true)}
              disabled={busy}
              data-testid="pos-unclosed-force-open"
            >
              Abrir día igualmente
            </button>
          </div>
        </div>
      </div>
      {confirmForce ? (
        <POSForceOpenConfirmModal
          count={unclosedPrevious.length}
          busy={busy}
          onCancel={() => setConfirmForce(false)}
          onConfirm={() => void forceOpen()}
        />
      ) : null}
    </>,
    document.getElementById("bo-portal") || document.body,
  );
}
