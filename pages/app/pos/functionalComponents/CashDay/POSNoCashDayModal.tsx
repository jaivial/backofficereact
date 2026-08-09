import React, { useCallback, useState } from "react";

import type { POSCashDay } from "../../../../../api/types";
import { POSCashDayDatePicker } from "../../../../../ui/widgets/POSCashDayDatePicker";

/** "17 de febrero de 2026". */
export function formatSpanishLongDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

export type POSNoCashDayModalProps = {
  date: string;
  error?: string;
  liveDay?: POSCashDay | null;
  onOpenDay: (openingCashCents: number) => Promise<boolean>;
  onPickDate: (iso: string) => void;
};

/**
 * Gate shown when the selected business date has no till open. It deliberately
 * has no close affordance: dismissing it would leave the sell screen usable
 * with no cash day to book the sales against.
 */
export function POSNoCashDayModal({ date, error, liveDay, onOpenDay, onPickDate }: POSNoCashDayModalProps) {
  const [openingCash, setOpeningCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const confirm = useCallback(async () => {
    // The float is optional, and an empty field means "no change in the
    // drawer", not a refusal to open.
    const parsed = Number((openingCash || "0").replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setBusy(true);
    try {
      await onOpenDay(Math.round(parsed * 100));
    } finally {
      setBusy(false);
    }
  }, [onOpenDay, openingCash]);

  return (
    <div className="pos-modalBackdrop" role="presentation" data-testid="pos-no-cash-day-backdrop">
      <div className="pos-modal" role="dialog" aria-modal="true" aria-label="No hay caja abierta" data-testid="pos-no-cash-day-modal">
        <header className="pos-modal__header" data-testid="pos-no-cash-day-header">
          <h2 data-testid="pos-no-cash-day-title">No hay caja abierta para el día {formatSpanishLongDate(date)}</h2>
        </header>
        <div className="pos-modal__confirm" data-testid="pos-no-cash-day-body">
          <label className="pos-modal__covers" htmlFor="pos-no-cash-day-float" data-testid="pos-no-cash-day-float-field">
            Fondo de caja (€)
            <input
              id="pos-no-cash-day-float"
              inputMode="decimal"
              placeholder="0"
              value={openingCash}
              onChange={(event) => setOpeningCash(event.target.value)}
              data-ui="pos-no-cash-day-float"
              data-testid="pos-no-cash-day-float"
            />
          </label>
          {error ? <p className="pos-modal__error" role="alert" data-testid="pos-no-cash-day-error">{error}</p> : null}
          <button
            className="pos-modal__primary"
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            data-testid="pos-no-cash-day-open"
          >
            Abrir día
          </button>
          {picking ? (
            <POSCashDayDatePicker value={date} onChange={onPickDate} liveDay={liveDay} data-testid="pos-no-cash-day-picker" />
          ) : (
            <button
              className="pos-modal__secondary"
              type="button"
              disabled={busy}
              onClick={() => setPicking(true)}
              data-testid="pos-no-cash-day-pick"
            >
              Elegir otro día
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
