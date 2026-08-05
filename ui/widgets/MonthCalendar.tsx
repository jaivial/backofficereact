import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import { cn } from "../shadcn/utils";
import type { CalendarDay } from "../../api/types";

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

type MonthCalendarProps = {
  year: number;
  month: number; // 1..12
  days: CalendarDay[];
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading: boolean;
  className?: string;
  /** Optional per-day tooltip content shown on hover/tap. Return null to skip a day. */
  renderDayTooltip?: (dateISO: string) => React.ReactNode;
};

type MonthCalendarCell =
  | { key: string; kind: "empty" }
  | {
      key: string;
      kind: "day";
      dateISO: string;
      day: number;
      label: string;
      className: string;
      ratioLabel: string;
      isOpen: boolean;
      isSelected: boolean;
    };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthNameES(month1to12: number): string {
  const names = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  return names[month1to12 - 1] || "";
}

function weekdayIndexMondayStart(dow0Sun: number): number {
  // 0=Sun..6=Sat -> 0=Mon..6=Sun
  return (dow0Sun + 6) % 7;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

const MonthCalendarGrid = memo(function MonthCalendarGrid({
  cells,
  onSelectDate,
  loading,
  onDayEnter,
  onDayLeave,
  setCellRef,
}: {
  cells: MonthCalendarCell[];
  onSelectDate: (dateISO: string) => void;
  loading: boolean;
  onDayEnter?: (dateISO: string) => void;
  onDayLeave?: () => void;
  setCellRef?: (dateISO: string, el: HTMLButtonElement | null) => void;
}) {
  const handleSelectDate = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) return;
      const dateISO = event.currentTarget.dataset.date;
      if (dateISO) onSelectDate(dateISO);
    },
    [loading, onSelectDate],
  );

  const handleEnter = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const dateISO = event.currentTarget.dataset.date;
      if (dateISO) onDayEnter?.(dateISO);
    },
    [onDayEnter],
  );

  return (
    <div className="bo-mcalGrid" role="grid" data-slot="month-calendar-grid">
      {cells.map((cell) => {
        if (cell.kind === "empty") {
          return <div key={cell.key} className="bo-mcalCell is-empty" aria-hidden="true" data-slot="month-calendar-cell-empty" />;
        }

        return (
          <button
            key={cell.key}
            ref={setCellRef ? (el) => setCellRef(cell.dateISO, el) : undefined}
            className={cell.className}
            type="button"
            role="gridcell"
            aria-label={cell.label}
            aria-selected={cell.isSelected}
            data-date={cell.dateISO}
            data-selected={cell.isSelected ? "true" : "false"}
            data-testid={`month-calendar-day-${cell.day}`}
            onClick={handleSelectDate}
            onMouseEnter={onDayEnter ? handleEnter : undefined}
            onMouseLeave={onDayLeave}
            data-slot="month-calendar-day-cell"
          >
            <div className="bo-mcalNum" data-slot="month-calendar-day-number">{cell.day}</div>
            <div className="bo-mcalSub" data-slot="month-calendar-day-sub">
              {!cell.isOpen ? <Lock className="bo-ico" /> : <span className="bo-mcalRatio" data-slot="month-calendar-day-ratio">{cell.ratioLabel}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
});

MonthCalendarGrid.displayName = "MonthCalendarGrid";

function MonthCalendarComponent({ year, month, days, selectedDateISO, onSelectDate, onPrevMonth, onNextMonth, loading, className, renderDayTooltip }: MonthCalendarProps) {
  // "today" is cosmetic only — compute it client-side to avoid SSR hydration mismatch
  // caused by server (UTC) and browser (local) timezone differences crossing midnight.
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    setToday(todayISO());
  }, []);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const setCellRef = useCallback((dateISO: string, el: HTMLButtonElement | null) => {
    if (el) cellRefs.current.set(dateISO, el);
    else cellRefs.current.delete(dateISO);
  }, []);

  const handleDayEnter = useCallback((dateISO: string) => {
    const btn = cellRefs.current.get(dateISO);
    if (!btn) return;
    setHoveredDate(dateISO);
    const rect = btn.getBoundingClientRect();
    setPopoverPos({ top: rect.bottom + 4, left: Math.max(8, rect.left) });
  }, []);

  const handleDayLeave = useCallback(() => {
    setHoveredDate(null);
    setPopoverPos(null);
  }, []);

  const tooltipContent = renderDayTooltip && hoveredDate ? renderDayTooltip(hoveredDate) : null;
  const monthLabel = useMemo(() => `${monthNameES(month)} ${year}`, [month, year]);
  const handlePrevMonth = useCallback(() => {
    if (loading) return;
    onPrevMonth();
  }, [loading, onPrevMonth]);
  const handleNextMonth = useCallback(() => {
    if (loading) return;
    onNextMonth();
  }, [loading, onNextMonth]);
  const cells = useMemo<MonthCalendarCell[]>(() => {
    const byDate = new Map(days.map((day) => [day.date, day]));
    const first = new Date(year, month - 1, 1);
    const firstDow = weekdayIndexMondayStart(first.getDay());
    const daysInMonth = new Date(year, month, 0).getDate();
    const nextCells: MonthCalendarCell[] = [];

    for (let i = 0; i < firstDow; i += 1) {
      nextCells.push({ key: `b-${i}`, kind: "empty" });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateISO = `${year}-${pad2(month)}-${pad2(day)}`;
      const calendarDay = byDate.get(dateISO);
      const isSelected = selectedDateISO === dateISO;
      const isToday = today === dateISO;
      const isOpen = calendarDay ? calendarDay.is_open : true;

      let occClass = "";
      if (calendarDay && isOpen) {
        const limit = calendarDay.limit || 0;
        const pct = limit > 0 ? (calendarDay.total_people / limit) * 100 : 0;
        if (pct >= 100) occClass = "occ-100";
        else if (pct >= 85) occClass = "occ-85";
        else if (pct >= 75) occClass = "occ-75";
        else if (pct >= 50) occClass = "occ-50";
      }

      nextCells.push({
        key: dateISO,
        kind: "day",
        dateISO,
        day,
        label: !isOpen
          ? `${dateISO}: cerrado`
          : `${dateISO}: ${calendarDay ? `${calendarDay.total_people}/${calendarDay.limit} pax` : "abierto"}`,
        className: [
          "bo-mcalCell",
          isSelected ? "is-selected" : "",
          isToday ? "is-today" : "",
          !isOpen ? "is-closed" : "is-open",
          occClass,
        ]
          .filter(Boolean)
          .join(" "),
        ratioLabel: calendarDay ? `${calendarDay.total_people}/${calendarDay.limit}` : "—",
        isOpen,
        isSelected,
      });
    }

    return nextCells;
  }, [days, month, selectedDateISO, today, year]);

  return (
    <section className={cn("bo-mcal bo-mcal--glass", className)} aria-label="Calendario mensual" aria-busy={loading} data-testid="month-calendar">
      <header className="bo-mcalHead" data-testid="month-calendar-header" data-slot="month-calendar-header">
        <div className="bo-mcalTitle" data-slot="month-calendar-title">{monthLabel}</div>
        <div className="bo-mcalNav" data-slot="month-calendar-nav">
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={handlePrevMonth} aria-label="Mes anterior" data-testid="month-calendar-prev">
            <ChevronLeft className="bo-ico" />
          </button>
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={handleNextMonth} aria-label="Mes siguiente" data-testid="month-calendar-next">
            <ChevronRight className="bo-ico" />
          </button>
        </div>
      </header>

      <div className="bo-mcalDows" aria-hidden="true" data-slot="month-calendar-weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bo-mcalDow" data-slot="month-calendar-weekday">
            {label}
          </div>
        ))}
      </div>

      <MonthCalendarGrid
        cells={cells}
        onSelectDate={onSelectDate}
        loading={loading}
        onDayEnter={renderDayTooltip ? handleDayEnter : undefined}
        onDayLeave={renderDayTooltip ? handleDayLeave : undefined}
        setCellRef={renderDayTooltip ? setCellRef : undefined}
      />

      {typeof document !== "undefined" && tooltipContent && popoverPos
        ? createPortal(
            <div className="fixed z-[10000]" style={{ top: popoverPos.top, left: popoverPos.left }} data-slot="month-calendar-tooltip">
              {tooltipContent}
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}

export const MonthCalendar = memo(MonthCalendarComponent);
MonthCalendar.displayName = "MonthCalendar";
