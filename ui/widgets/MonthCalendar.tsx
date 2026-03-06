import React, { memo, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

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
}: {
  cells: MonthCalendarCell[];
  onSelectDate: (dateISO: string) => void;
  loading: boolean;
}) {
  const handleSelectDate = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading) return;
      const dateISO = event.currentTarget.dataset.date;
      if (dateISO) onSelectDate(dateISO);
    },
    [loading, onSelectDate],
  );

  return (
    <div className="bo-mcalGrid" role="grid">
      {cells.map((cell) => {
        if (cell.kind === "empty") {
          return <div key={cell.key} className="bo-mcalCell is-empty" aria-hidden="true" />;
        }

        return (
          <button
            key={cell.key}
            className={cell.className}
            type="button"
            role="gridcell"
            aria-label={cell.label}
            aria-selected={cell.isSelected}
            data-date={cell.dateISO}
            onClick={handleSelectDate}
          >
            <div className="bo-mcalNum">{cell.day}</div>
            <div className="bo-mcalSub">
              {!cell.isOpen ? <Lock className="bo-ico" /> : <span className="bo-mcalRatio">{cell.ratioLabel}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
});

MonthCalendarGrid.displayName = "MonthCalendarGrid";

function MonthCalendarComponent({ year, month, days, selectedDateISO, onSelectDate, onPrevMonth, onNextMonth, loading }: MonthCalendarProps) {
  const today = useMemo(() => todayISO(), []);
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
    <section className="bo-mcal bo-mcal--glass" aria-label="Calendario mensual" aria-busy={loading}>
      <header className="bo-mcalHead">
        <div className="bo-mcalTitle">{monthLabel}</div>
        <div className="bo-mcalNav">
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={handlePrevMonth} aria-label="Mes anterior">
            <ChevronLeft className="bo-ico" />
          </button>
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={handleNextMonth} aria-label="Mes siguiente">
            <ChevronRight className="bo-ico" />
          </button>
        </div>
      </header>

      <div className="bo-mcalDows" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bo-mcalDow">
            {label}
          </div>
        ))}
      </div>

      <MonthCalendarGrid cells={cells} onSelectDate={onSelectDate} loading={loading} />
    </section>
  );
}

export const MonthCalendar = memo(MonthCalendarComponent);
MonthCalendar.displayName = "MonthCalendar";
