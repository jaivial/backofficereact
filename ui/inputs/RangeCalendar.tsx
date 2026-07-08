import React, { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { formatISODate, parseISODate } from "../lib/format";

export type RangeValue = {
  from: string;
  to: string;
};

export function sortedRange(from: string, to: string): RangeValue {
  if (!from) return { from: "", to: "" };
  if (!to) return { from, to: "" };
  if (to < from) return { from: to, to: from };
  return { from, to };
}

function monthLabel(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0, 1));
  return d.toLocaleString("es-ES", { month: "long", year: "numeric" });
}

function buildMonthGrid(year: number, month0: number) {
  const first = new Date(Date.UTC(year, month0, 1));
  const firstDow = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, iso: formatISODate(new Date(Date.UTC(year, month0, d))) });
  }
  return cells;
}

/**
 * Hook holding the two-click range selection draft plus month navigation.
 * Shared by DateRangePicker (popover) and CloseDateRangeModal (modal) so the
 * range-selection behaviour lives in one place.
 */
export function useRangeCalendar(value: RangeValue) {
  const [draft, setDraft] = useState<RangeValue>(() => sortedRange(value.from, value.to));
  const anchor = useMemo(() => parseISODate(value.from) ?? new Date(), [value.from]);
  const [viewYear, setViewYear] = useState(anchor.getUTCFullYear());
  const [viewMonth0, setViewMonth0] = useState(anchor.getUTCMonth());

  const resetTo = useCallback((next: RangeValue) => {
    const normalized = sortedRange(next.from, next.to);
    setDraft(normalized);
    const focus = parseISODate(normalized.from) ?? new Date();
    setViewYear(focus.getUTCFullYear());
    setViewMonth0(focus.getUTCMonth());
  }, []);

  const prevMonth = useCallback(() => {
    setViewMonth0((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setViewMonth0((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  const selectDay = useCallback((iso: string) => {
    setDraft((curr) => {
      if (!curr.from || curr.to) return { from: iso, to: "" };
      if (iso < curr.from) return { from: iso, to: curr.from };
      return { from: curr.from, to: iso };
    });
  }, []);

  const clear = useCallback(() => setDraft({ from: "", to: "" }), []);

  return { draft, setDraft, viewYear, viewMonth0, prevMonth, nextMonth, selectDay, clear, resetTo };
}

type RangeCalendarProps = {
  draft: RangeValue;
  viewYear: number;
  viewMonth0: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (iso: string) => void;
  /** data-ui prefix so callers keep their existing hooks/selectors. */
  uiPrefix: string;
};

/**
 * Presentational month calendar with range highlighting. Markup/classnames are
 * identical to the date-dropdown-popover / date-range-picker so styling is shared.
 */
export function RangeCalendar({
  draft,
  viewYear,
  viewMonth0,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
  uiPrefix,
}: RangeCalendarProps) {
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth0), [viewMonth0, viewYear]);
  const hasDraft = Boolean(draft.from);
  const fromISO = draft.from;
  const toISO = draft.to || draft.from;

  return (
    <>
      <div className="bo-dateHead" data-ui={`${uiPrefix}-header`}>
        <button type="button" className="bo-actionBtn bo-actionBtn--glass" onClick={onPrevMonth} aria-label="Mes anterior" data-ui={`${uiPrefix}-prev-btn`}>
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <div className="bo-dateTitle" data-ui={`${uiPrefix}-month-label`}>{monthLabel(viewYear, viewMonth0)}</div>
        <button type="button" className="bo-actionBtn bo-actionBtn--glass" onClick={onNextMonth} aria-label="Mes siguiente" data-ui={`${uiPrefix}-next-btn`}>
          <ChevronRight size={18} strokeWidth={1.8} />
        </button>
      </div>
      <div className="bo-calDows" aria-hidden="true" data-ui={`${uiPrefix}-weekdays`}>
        <div data-ui={`${uiPrefix}-weekday`}>L</div>
        <div data-ui={`${uiPrefix}-weekday`}>M</div>
        <div data-ui={`${uiPrefix}-weekday`}>M</div>
        <div data-ui={`${uiPrefix}-weekday`}>J</div>
        <div data-ui={`${uiPrefix}-weekday`}>V</div>
        <div data-ui={`${uiPrefix}-weekday`}>S</div>
        <div data-ui={`${uiPrefix}-weekday`}>D</div>
      </div>
      <div className="bo-calGrid" aria-label="Calendario de rango" data-ui={`${uiPrefix}-grid`}>
        {grid.map((c, idx) => {
          if (!c.day || !c.iso) return <div key={idx} className="bo-calDay bo-calDay--empty" aria-hidden="true" data-ui={`${uiPrefix}-empty-cell`} />;
          const iso = c.iso;
          const isStart = hasDraft && iso === fromISO;
          const isEnd = hasDraft && iso === toISO;
          const isInRange = hasDraft && iso > fromISO && iso < toISO;
          const cls = [
            "bo-calDay",
            isInRange ? "is-inRange" : "",
            isStart ? "is-rangeStart" : "",
            isEnd ? "is-rangeEnd" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button key={iso} type="button" className={cls} onClick={() => onSelectDay(iso)} data-ui={`${uiPrefix}-day`} data-date={iso}>
              {c.day}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function rangeToISODates(from: string, to: string): string[] {
  const start = parseISODate(from);
  const end = parseISODate(to || from);
  if (!start || !end) return [];
  const lo = start <= end ? start : end;
  const hi = start <= end ? end : start;
  const out: string[] = [];
  const cur = new Date(Date.UTC(lo.getUTCFullYear(), lo.getUTCMonth(), lo.getUTCDate()));
  const last = new Date(Date.UTC(hi.getUTCFullYear(), hi.getUTCMonth(), hi.getUTCDate()));
  let guard = 0;
  while (cur <= last && guard < 3660) {
    out.push(formatISODate(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}
