import React, { useCallback, useEffect, useRef, useState } from "react";

import { POSCashDayDatePicker } from "../../../../../ui/widgets/POSCashDayDatePicker";

/** "17 de febrero de 2026". */
export function formatSpanishLongDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/** No till starts a service on more than this, so anything above it is a typo. */
const MAX_OPENING_CASH_CENTS = 1_000_000_00;

/**
 * Reads a cash float typed on a Spanish keypad into cents, or null if it is not
 * a usable amount. Both separators are accepted because the operator may be on
 * a numeric keypad that only emits `.`: when both appear the last one is the
 * decimal mark, and a lone separator trailed by exactly three digits is a
 * thousands mark, so "1.500" is a day starting with 1500 €, not 1,50 €.
 *
 * Whatever is left of the decimal mark still has to be a well-formed number,
 * grouped or not. Without that check a slipped keypress ("1..50") would parse
 * as grouping and open the till on a hundred times the intended float.
 */
export function parseCashFloatCents(raw: string): number | null {
  const trimmed = raw.replace(/[\s\u00a0€]/g, "");
  if (!trimmed) return 0;
  if (!/^\d[\d.,]*$/.test(trimmed)) return null;

  const lastDot = trimmed.lastIndexOf(".");
  const lastComma = trimmed.lastIndexOf(",");
  let decimalAt = -1;
  if (lastDot >= 0 && lastComma >= 0) decimalAt = Math.max(lastDot, lastComma);
  else {
    const only = Math.max(lastDot, lastComma);
    // A leading zero rules the grouping reading out: nobody writes 5 € as
    // "0,005", so that has to stay three decimals rather than become 500 cents.
    const looksGrouped = /^\d{3}$/.test(trimmed.slice(only + 1)) && /^[1-9]\d{0,2}$/.test(trimmed.slice(0, only));
    const isGrouping = only >= 0 && (trimmed.split(trimmed[only]).length > 2 || looksGrouped);
    decimalAt = only >= 0 && !isGrouping ? only : -1;
  }

  const wholeRaw = decimalAt >= 0 ? trimmed.slice(0, decimalAt) : trimmed;
  const fraction = decimalAt >= 0 ? trimmed.slice(decimalAt + 1) : "";
  if (!/^\d+$/.test(wholeRaw) && !/^[1-9]\d{0,2}(?:[.,]\d{3})+$/.test(wholeRaw)) return null;
  if (fraction && !/^\d+$/.test(fraction)) return null;

  const value = Number(`${wholeRaw.replace(/[.,]/g, "")}.${fraction || "0"}`);
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(value * 100);
  return cents > MAX_OPENING_CASH_CENTS ? null : cents;
}

export type POSNoCashDayModalProps = {
  date: string;
  error?: string;
  onOpenDay: (openingCashCents: number) => Promise<boolean>;
  onPickDate: (iso: string) => void;
};

/**
 * Gate shown when the selected business date has no till open. It replaces the
 * sell screen rather than covering the page: dismissing it would leave the sell
 * screen usable with no cash day to book the sales against, but locking the
 * whole page would also strand the operator away from Informes, which is where
 * an earlier unsealed day has to be closed before this one can open.
 */
export function POSNoCashDayModal({ date, error, onOpenDay, onPickDate }: POSNoCashDayModalProps) {
  const [openingCash, setOpeningCash] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState("");
  const floatRef = useRef<HTMLInputElement | null>(null);

  // The gate is the only thing on the sell section, so the field it wants
  // filled is where the caret belongs.
  useEffect(() => { floatRef.current?.focus(); }, []);

  const confirm = useCallback(async () => {
    // The float is optional, and an empty field means "no change in the
    // drawer", not a refusal to open.
    const cents = parseCashFloatCents(openingCash);
    if (cents === null) {
      setInvalid("Escribe un importe válido de 0 € o más.");
      return;
    }
    setInvalid("");
    setBusy(true);
    try {
      await onOpenDay(cents);
    } finally {
      setBusy(false);
    }
  }, [onOpenDay, openingCash]);

  const reason = invalid || error || "";

  return (
    <section className="pos-cashGate" aria-labelledby="pos-no-cash-day-title" data-ui="pos-no-cash-day-gate" data-testid="pos-no-cash-day-modal">
      <header className="pos-cashGate__header" data-testid="pos-no-cash-day-header">
        <h2 id="pos-no-cash-day-title" data-testid="pos-no-cash-day-title">No hay caja abierta para el día {formatSpanishLongDate(date)}</h2>
        <p className="pos-cashGate__hint" data-testid="pos-no-cash-day-hint">Abre la caja para poder registrar ventas, o consulta otro día.</p>
      </header>
      <div className="pos-cashGate__body" data-testid="pos-no-cash-day-body">
        <label className="pos-cashGate__field" htmlFor="pos-no-cash-day-float" data-testid="pos-no-cash-day-float-field">
          Fondo de caja (€)
          <input
            id="pos-no-cash-day-float"
            ref={floatRef}
            inputMode="decimal"
            placeholder="0"
            value={openingCash}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={reason ? "pos-no-cash-day-error" : undefined}
            onChange={(event) => { setOpeningCash(event.target.value); setInvalid(""); }}
            data-ui="pos-no-cash-day-float"
            data-testid="pos-no-cash-day-float"
          />
        </label>
        {reason ? <p className="pos-cashGate__error" id="pos-no-cash-day-error" role="alert" data-testid="pos-no-cash-day-error">{reason}</p> : null}
        <div className="pos-cashGate__actions" data-testid="pos-no-cash-day-actions">
          <button
            className="pos-cashGate__submit"
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            data-testid="pos-no-cash-day-open"
          >
            Abrir día
          </button>
          <POSCashDayDatePicker value={date} onChange={onPickDate} disabled={busy} data-testid="pos-no-cash-day-picker" />
        </div>
      </div>
    </section>
  );
}
