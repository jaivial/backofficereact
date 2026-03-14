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
    <div className="grid grid-cols-7 gap-[3px] sm:gap-1" role="grid">
      {cells.map((cell) => {
        if (cell.kind === "empty") {
          return <div key={cell.key} className="aspect-[1/1] min-h-[34px] sm:min-h-[40px] md:min-h-[56px] rounded-[10px] sm:rounded-[12px] md:rounded-[16px] border border-transparent bg-transparent cursor-default" aria-hidden="true" />;
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
            <div className="text-[11px] sm:text-[13px] md:text-[16px] font-bold">{cell.day}</div>
            <div className="flex items-center justify-center">
              {!cell.isOpen ? <Lock size={10} strokeWidth={1.8} className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <span className="text-[8px] sm:text-[9px] md:text-[10px]">{cell.ratioLabel}</span>}
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
          "aspect-[1/1] min-h-[34px] sm:min-h-[40px] md:min-h-[56px] rounded-[10px] sm:rounded-[12px] md:rounded-[16px] border border-white/[0.06] bg-white/[0.02] text-foreground p-1 sm:p-1.5 md:p-2 flex flex-col justify-between items-center text-center cursor-pointer transition-all duration-120 hover:-translate-y-0.5 hover:border-white/[0.12]",
          isSelected ? "border-primary/35 shadow-[0_18px_46px_rgba(185,168,255,0.10)]" : "",
          isToday ? "outline-2 outline-offset-2 outline-cyan-400/30" : "",
          !isOpen ? "opacity-60" : "",
          occClass === "occ-100" ? "bg-red-500/20 border-red-500/40" : "",
          occClass === "occ-85" ? "bg-orange-500/20 border-orange-500/40" : "",
          occClass === "occ-75" ? "bg-yellow-500/20 border-yellow-500/40" : "",
          occClass === "occ-50" ? "bg-green-500/20 border-green-500/40" : "",
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
    <section className="rounded-2xl bg-gradient-to-b from-white/[0.04] to-black/[0.10] border border-white/[0.06] shadow-soft p-3.5 min-w-0 overflow-hidden" aria-label="Calendario mensual" aria-busy={loading}>
      <header className="flex items-center justify-between gap-3 mb-2.5">
        <div className="font-semibold tracking-wide">{monthLabel}</div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground" type="button" onClick={handlePrevMonth} aria-label="Mes anterior">
            <ChevronLeft size={18} strokeWidth={1.8} />
          </button>
          <button className="w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.02] text-muted-foreground grid place-items-center cursor-pointer transition-all hover:bg-white/[0.04] hover:-translate-y-0.5 hover:text-foreground" type="button" onClick={handleNextMonth} aria-label="Mes siguiente">
            <ChevronRight size={18} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-1 px-0.5 py-1 text-[11px] text-white/50 text-center mb-2" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>
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
