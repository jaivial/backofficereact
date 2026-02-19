import React, { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";

import type { CalendarDay } from "../../api/types";

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

export function MonthCalendar({
  year,
  month,
  days,
  selectedDateISO,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  loading,
}: {
  year: number;
  month: number; // 1..12
  days: CalendarDay[];
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  loading: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const today = useMemo(() => todayISO(), []);
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);

  const first = new Date(year, month - 1, 1);
  const firstDow = weekdayIndexMondayStart(first.getDay());
  const daysInMonth = new Date(year, month, 0).getDate();

  const blanks = Array.from({ length: firstDow }, (_, i) => i);
  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthKey = `${year}-${pad2(month)}`;
  const transition = reduceMotion ? { duration: 0 } : { duration: 1, ease: "easeInOut" as const };

  return (
    <section className="bo-mcal bo-mcal--glass" aria-label="Calendario mensual">
      <header className="bo-mcalHead">
        <div className="bo-mcalTitle">
          {monthNameES(month)} {year}
          <span className="bo-mcalMeta">{loading ? "Cargando..." : ""}</span>
        </div>
        <div className="bo-mcalNav">
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onPrevMonth} aria-label="Mes anterior" disabled={loading}>
            <ChevronLeft className="bo-ico" />
          </button>
          <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onNextMonth} aria-label="Mes siguiente" disabled={loading}>
            <ChevronRight className="bo-ico" />
          </button>
        </div>
      </header>

      <div className="bo-mcalDows" aria-hidden="true">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <div key={d} className="bo-mcalDow">
            {d}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={monthKey}
          className="bo-mcalGrid"
          role="grid"
          initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={transition}
        >
          {blanks.map((i) => (
            <div key={`b-${i}`} className="bo-mcalCell is-empty" aria-hidden="true" />
          ))}

          {dayNums.map((day) => {
            const dateISO = `${year}-${pad2(month)}-${pad2(day)}`;
            const d = byDate.get(dateISO);
            const isSelected = selectedDateISO === dateISO;
            const isToday = today === dateISO;
            const isOpen = d ? d.is_open : true;

            let occClass = "";
            if (d && isOpen) {
              const limit = d.limit || 0;
              const pct = limit > 0 ? (d.total_people / limit) * 100 : 0;
              if (pct >= 100) occClass = "occ-100";
              else if (pct >= 85) occClass = "occ-85";
              else if (pct >= 75) occClass = "occ-75";
              else if (pct >= 50) occClass = "occ-50";
            }

            const cls = [
              "bo-mcalCell",
              isSelected ? "is-selected" : "",
              isToday ? "is-today" : "",
              !isOpen ? "is-closed" : "is-open",
              occClass,
            ]
              .filter(Boolean)
              .join(" ");

            const label = !isOpen
              ? `${dateISO}: cerrado`
              : `${dateISO}: ${d ? `${d.total_people}/${d.limit} pax` : "abierto"}`;

            return (
              <button key={dateISO} className={cls} type="button" onClick={() => onSelectDate(dateISO)} role="gridcell" aria-label={label}>
                <div className="bo-mcalNum">{day}</div>
                <div className="bo-mcalSub">
                  {!isOpen ? (
                    <Lock className="bo-ico" />
                  ) : (
                    <span className="bo-mcalRatio">{d ? `${d.total_people}/${d.limit}` : "—"}</span>
                  )}
                </div>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
