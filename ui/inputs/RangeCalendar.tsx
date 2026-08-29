import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  disabledDates?: Set<string>;
  disabledDateLabels?: Map<string, string>;
  /** data-ui prefix so callers keep their existing hooks/selectors. */
  uiPrefix: string;
  /**
   * Enable pointer drag-select: press on a day and drag across days to build
   * the range live, with a connecting line drawn through the selected cells.
   * Clicking still works as the regular two-click selection. Off by default so
   * shared callers (DateRangePicker) keep their current behaviour.
   */
  dragSelect?: boolean;
};

type LinePoint = { x: number; y: number };
type Line = { points: LinePoint[]; w: number; h: number };

// A drag gesture is considered started once the pointer travels this many px.
const DRAG_THRESHOLD_PX = 5;

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
  disabledDates,
  disabledDateLabels,
  uiPrefix,
  dragSelect = false,
}: RangeCalendarProps) {
  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth0), [viewMonth0, viewYear]);
  const hasDraft = Boolean(draft.from);
  const fromISO = draft.from;
  const toISO = draft.to || draft.from;

  const gridRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef<{ [iso: string]: HTMLButtonElement | null }>({});
  const dragRef = useRef<{
    origin: string | null;
    dragging: boolean;
    moved: boolean;
    startX: number;
    startY: number;
  }>({ origin: null, dragging: false, moved: false, startX: 0, startY: 0 });
  const suppressClick = useRef(false);
  const lastHover = useRef<string | null>(null);
  const [line, setLine] = useState<Line | null>(null);

  // Recompute the connecting line whenever the selection (or visible month)
  // changes, from the on-screen centres of the selected cells.
  useLayoutEffect(() => {
    if (!dragSelect || !gridRef.current || !draft.from) {
      setLine(null);
      return;
    }
    const lo = parseISODate(draft.from);
    const hi = parseISODate(draft.to || draft.from);
    if (!lo || !hi) {
      setLine(null);
      return;
    }
    const first = lo <= hi ? lo : hi;
    const last = lo <= hi ? hi : lo;
    const gridRect = gridRef.current.getBoundingClientRect();
    const points: LinePoint[] = [];
    const cur = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate()));
    const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate()));
    let guard = 0;
    while (cur <= end && guard < 60) {
      const iso = formatISODate(cur);
      const el = cellRefs.current[iso];
      if (el) {
        const r = el.getBoundingClientRect();
        points.push({ x: r.left + r.width / 2 - gridRect.left, y: r.top + r.height / 2 - gridRect.top });
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
      guard += 1;
    }
    setLine(points.length >= 2 ? { points, w: gridRect.width, h: gridRect.height } : null);
  }, [draft.from, draft.to, dragSelect, viewMonth0, viewYear]);

  // ── Pointer drag selection ───────────────────────────────────────────────
  // A drag is tracked from a fresh press (origin) until pointerup. Once the
  // pointer moves past DRAG_THRESHOLD_PX the gesture becomes a drag: a new
  // range is anchored at the pressed day and every day hovered in between
  // extends it live. A press released without movement stays a plain click
  // (two-click selection) so normal tap behaviour is preserved.
  //
  // Move/up are handled at window level instead of on the grid so the drag
  // keeps tracking even when the pointer leaves the calendar before release.
  const onWindowMove = useCallback(
    (e: PointerEvent) => {
      const s = dragRef.current;
      if (!s.origin) return;
      if (!s.dragging) {
        const dx = e.clientX - s.startX;
        const dy = e.clientY - s.startY;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        s.moved = true;
        s.dragging = true;
        suppressClick.current = true; // this gesture is a drag, not a click
        onSelectDay(s.origin); // start a fresh range anchored at the pressed day
      }
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const day = under?.closest(`[data-ui$="-day"]`);
      const iso = day?.closest?.("[data-date]")?.getAttribute?.("data-date");
      if (iso && iso !== lastHover.current) {
        lastHover.current = iso;
        onSelectDay(iso);
      }
    },
    [onSelectDay],
  );

  const onWindowUp = useCallback(() => {
    dragRef.current = { origin: null, dragging: false, moved: false, startX: 0, startY: 0 };
  }, []);

  useEffect(() => {
    if (!dragSelect) return;
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", onWindowUp);
    };
  }, [dragSelect, onWindowMove, onWindowUp]);

  const handlePointerDown = useCallback(
    (iso: string, clientX: number, clientY: number) => {
      if (!dragSelect) return;
      suppressClick.current = false; // a fresh gesture is never a drag until it moves
      lastHover.current = null;
      dragRef.current = { origin: iso, dragging: false, moved: false, startX: clientX, startY: clientY };
    },
    [dragSelect],
  );

  const handleDragHover = useCallback(
    (iso: string) => {
      if (dragRef.current.dragging && iso !== lastHover.current) {
        lastHover.current = iso;
        onSelectDay(iso); // extends the live range
      }
    },
    [onSelectDay],
  );

  const handleClick = useCallback(
    (iso: string) => {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      onSelectDay(iso); // plain click -> regular two-click selection
    },
    [onSelectDay],
  );

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
      <div
        ref={gridRef}
        className={`bo-calGrid${dragSelect ? " bo-rangeDrag" : ""}`}
        aria-label="Calendario de rango"
        data-ui={`${uiPrefix}-grid`}
      >
        {grid.map((c, idx) => {
          if (!c.day || !c.iso) return <div key={idx} className="bo-calDay bo-calDay--empty" aria-hidden="true" data-ui={`${uiPrefix}-empty-cell`} />;
          const iso = c.iso;
          const isBlocked = disabledDates?.has(iso) ?? false;
          const isStart = hasDraft && iso === fromISO;
          const isEnd = hasDraft && iso === toISO;
          const isInRange = hasDraft && iso > fromISO && iso < toISO;
          const cls = [
            "bo-calDay",
            isInRange ? "is-inRange" : "",
            isStart ? "is-rangeStart" : "",
            isEnd ? "is-rangeEnd" : "",
            isBlocked ? "is-blocked" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={iso}
              type="button"
              className={cls}
              ref={(el) => {
                cellRefs.current[iso] = el;
              }}
              onClick={() => { if (!isBlocked) handleClick(iso); }}
              disabled={isBlocked}
              onPointerDown={dragSelect ? (e) => handlePointerDown(iso, e.clientX, e.clientY) : undefined}
              onPointerEnter={dragSelect ? () => handleDragHover(iso) : undefined}
              aria-label={isBlocked && disabledDateLabels?.get(iso) ? `${iso}: ${disabledDateLabels.get(iso)}` : undefined}
              data-ui={`${uiPrefix}-day`}
              data-date={iso}
            >
              {c.day}
            </button>
          );
        })}
        {line ? (
          <svg
            className="bo-rangeLine"
            width={line.w}
            height={line.h}
            viewBox={`0 0 ${line.w} ${line.h}`}
            aria-hidden="true"
          >
            <polyline
              points={line.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
              fill="none"
            />
          </svg>
        ) : null}
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
