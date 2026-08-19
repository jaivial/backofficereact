import { useCallback, useEffect, useRef, useState } from "react";

import type { createClient } from "../../api/client";
import type { CalendarDay } from "../../api/types";

export type MonthView = { year: number; month: number };

type Api = Pick<ReturnType<typeof createClient>, "calendar">;

/** Month view (1..12) containing an ISO date; falls back to the current month. */
export function monthViewForDate(iso: string): MonthView {
  const [y, m] = String(iso).split("-").map(Number);
  const now = new Date();
  return {
    year: Number.isFinite(y) ? y : now.getFullYear(),
    month: Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1,
  };
}

export function prevMonth({ year, month }: MonthView): MonthView {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth({ year, month }: MonthView): MonthView {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/**
 * Month grid data for the occupancy calendar picker: keeps the visible month in
 * sync with the selected date and fetches `GET /api/admin/calendar` whenever it
 * changes. Shared by the table map and the reservas config toolbar.
 */
export function useMonthCalendar(api: Api, selectedDate: string) {
  const [view, setView] = useState<MonthView>(() => monthViewForDate(selectedDate));
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [loading, setLoading] = useState(false);

  // Selecting a date outside the visible month pulls the calendar along.
  useEffect(() => {
    const target = monthViewForDate(selectedDate);
    setView((prev) => (prev.year === target.year && prev.month === target.month ? prev : target));
  }, [selectedDate]);

  // Held in a ref so an unmemoized client from the caller cannot retrigger the fetch.
  const apiRef = useRef(api);
  apiRef.current = api;

  // Ignore responses from a month the user already navigated away from.
  const requestId = useRef(0);
  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    void apiRef.current.calendar
      .getMonth({ year: view.year, month: view.month })
      .then((res) => {
        if (id !== requestId.current) return;
        setDays(res.success ? ((res as { data?: CalendarDay[] }).data ?? []) : []);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [view.year, view.month]);

  const onPrevMonth = useCallback(() => setView(prevMonth), []);
  const onNextMonth = useCallback(() => setView(nextMonth), []);

  return { year: view.year, month: view.month, days, loading, onPrevMonth, onNextMonth };
}
