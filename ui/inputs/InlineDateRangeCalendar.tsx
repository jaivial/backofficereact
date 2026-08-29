import React, { useCallback, useEffect, useMemo } from "react";

import { RangeCalendar, sortedRange, useRangeCalendar } from "./RangeCalendar";
import { parseISODate } from "../lib/format";

type Props = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  disabledDates?: Set<string>;
  disabledDateLabels?: Map<string, string>;
};

function formatDate(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return "Sin fecha";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

function inclusiveDays(from: string, to: string): number {
  const start = parseISODate(from);
  const end = parseISODate(to || from);
  if (!start || !end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function InlineDateRangeCalendar({ from, to, onChange, disabledDates, disabledDateLabels }: Props) {
  const { draft, viewYear, viewMonth0, prevMonth, nextMonth, selectDay, clear, resetTo } = useRangeCalendar({ from, to });

  useEffect(() => {
    if (draft.from !== from || draft.to !== to) resetTo({ from, to });
  }, [from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseDay = useCallback((iso: string) => {
    let next = draft;
    if (!draft.from || draft.to) next = { from: iso, to: "" };
    else next = sortedRange(draft.from, iso);
    selectDay(iso);
    onChange(next);
  }, [draft, onChange, selectDay]);

  const days = useMemo(() => inclusiveDays(from, to), [from, to]);
  const rangeLabel = from ? `${formatDate(from)}${to ? ` – ${formatDate(to)}` : ""}` : "Sin rango seleccionado";

  return (
    <div className="bo-inlineDateRange" data-testid="inline-date-range-calendar" data-ui="inline-date-range-calendar">
      <div className="bo-inlineDateRangeSummary" data-ui="inline-date-range-summary">
        <strong data-testid="inline-date-range-summary">{rangeLabel}</strong>
        <span data-testid="inline-date-range-days">{days} {days === 1 ? "día activo" : "días activos"}</span>
      </div>
      <RangeCalendar
        draft={draft}
        viewYear={viewYear}
        viewMonth0={viewMonth0}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onSelectDay={chooseDay}
        disabledDates={disabledDates}
        disabledDateLabels={disabledDateLabels}
        uiPrefix="inline-date-range"
      />
      {from ? (
        <button type="button" className="bo-btn bo-btn--sm bo-btn--ghost" onClick={() => { clear(); onChange({ from: "", to: "" }); }}>
          Limpiar fechas
        </button>
      ) : null}
    </div>
  );
}
