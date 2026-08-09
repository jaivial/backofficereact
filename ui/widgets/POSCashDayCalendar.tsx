import React, { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "../../api/client";
import type { POSCashDay } from "../../api/types";
import { MonthCalendar } from "./MonthCalendar";

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function monthRange(year: number, month: number): { from: string; to: string } {
  return { from: `${year}-${pad2(month)}-01`, to: `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}` };
}

export type POSCashDayCalendarProps = {
  year: number;
  month: number; // 1..12
  selectedDateISO: string;
  onSelectDate: (dateISO: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  className?: string;
  /**
   * Day pushed by the live cash day state. It overrides whatever the month
   * request returned, so opening the till repaints its own cell at once.
   */
  liveDay?: POSCashDay | null;
};

/**
 * Month view of the till: which days were opened, which are sealed, and what
 * each one took. Wraps MonthCalendar through its `renderDaySub` and
 * `dayClassName` hooks so the reservations calendar keeps its own subtitle and
 * occupancy tones untouched.
 */
export function POSCashDayCalendar({ year, month, selectedDateISO, onSelectDate, onPrevMonth, onNextMonth, className, liveDay }: POSCashDayCalendarProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [days, setDays] = useState<POSCashDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = monthRange(year, month);
    setLoading(true);
    void (async () => {
      try {
        const response = await api.pos.cashDays.list({ from, to });
        if (cancelled) return;
        setDays(response.success ? response.items || [] : []);
      } catch {
        // A month that fails to load reads as a month with no till activity,
        // which is also what an empty answer looks like. Blanking the picker
        // would strand the user with no way back to a day that does exist.
        if (!cancelled) setDays([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, month, year]);

  const byDate = useMemo(() => {
    const map = new Map<string, POSCashDay>();
    for (const day of days) map.set(day.date, day);
    if (liveDay) map.set(liveDay.date, liveDay);
    return map;
  }, [days, liveDay]);

  const renderDaySub = useCallback((dateISO: string) => {
    const day = byDate.get(dateISO);
    if (!day) return null;
    return (
      <span className="bo-cashDaySub" data-slot="pos-cash-day-sub">
        <span className="bo-cashDayState" data-slot="pos-cash-day-state">{day.status === "OPEN" ? "Abierto" : "Cerrado"}</span>
        <span className="bo-cashDayTotal" data-slot="pos-cash-day-total">{eur.format((day.totalGrossCents || 0) / 100)}</span>
      </span>
    );
  }, [byDate]);

  const dayClassName = useCallback((dateISO: string) => {
    const day = byDate.get(dateISO);
    if (!day) return "is-noCash";
    return day.status === "OPEN" ? "is-cashOpen" : "is-cashClosed";
  }, [byDate]);

  return (
    <MonthCalendar
      year={year}
      month={month}
      // The reservations payload drives the lock icon and the pax ratio, both of
      // which this calendar replaces. An empty list keeps every day selectable.
      days={[]}
      selectedDateISO={selectedDateISO}
      onSelectDate={onSelectDate}
      onPrevMonth={onPrevMonth}
      onNextMonth={onNextMonth}
      loading={loading}
      className={className}
      renderDaySub={renderDaySub}
      dayClassName={dayClassName}
    />
  );
}
