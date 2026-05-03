import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { FichajeSchedule } from "../../../../../api/types";
import { DateRangePicker } from "../../../../../ui/inputs/DateRangePicker";
import { Tabs } from "../../../../../ui/nav/Tabs";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { DailyScheduleCard } from "../../preview/functionalComponents/MemberFilterView/DailyScheduleCard";
import { WeeklyScheduleTable } from "../../preview/functionalComponents/MemberFilterView/WeeklyScheduleTable";
import { generateDateRange, getWeekGroups } from "../../preview/helpers";
import { addDays, todayISO } from "../../utils";
import { MY_SCHEDULE_VIEW_KEY, MY_SCHEDULE_VIEW_TAB_ITEMS } from "../../constants";

function getInitialMyView(): "diario" | "semanal" {
  if (typeof window === "undefined") return "diario";
  const stored = localStorage.getItem(MY_SCHEDULE_VIEW_KEY);
  if (stored === "diario" || stored === "semanal") return stored;
  return "diario";
}

export function MyScheduleView({ initialSchedules }: { initialSchedules: FichajeSchedule[] }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(initialSchedules);
  const [dateFrom, setDateFrom] = useState(() => todayISO());
  const [dateTo, setDateTo] = useState(() => addDays(todayISO(), 6));
  const [view, setView] = useState<"diario" | "semanal">(getInitialMyView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  useEffect(() => {
    localStorage.setItem(MY_SCHEDULE_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSchedules() {
      setLoading(true);
      setError(null);
      try {
        const result = await api.horarios.getMySchedule({ from: dateFrom, to: dateTo });
        if (cancelled) return;
        if (result.success) {
          setSchedules(result.schedules || []);
        } else {
          setError(result.message || "Error al obtener horarios");
          setSchedules([]);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al obtener horarios");
        setSchedules([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSchedules();
    return () => { cancelled = true; };
  }, [api.horarios, dateFrom, dateTo]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, FichajeSchedule>();
    for (const s of schedules) {
      if (s.date) map.set(s.date, s);
    }
    return map;
  }, [schedules]);

  const datesInRange = useMemo(
    () => (dateFrom && dateTo ? generateDateRange(dateFrom, dateTo) : []),
    [dateFrom, dateTo],
  );

  const weekGroups = useMemo(
    () => getWeekGroups(datesInRange),
    [datesInRange],
  );

  const handleDateRangeChange = useCallback((next: { from: string; to: string }) => {
    setDateFrom(next.from);
    setDateTo(next.to);
  }, []);

  const handleViewChange = useCallback((id: string) => {
    setView(id as "diario" | "semanal");
  }, []);

  return (
    <section aria-label="Mis horarios" data-ui="myScheduleSection" className="bo-content-grid bo-horariosPage">
      <div data-ui="scheduleArea" className="flex-1 min-w-0">
        <div
          data-ui="controlsBar"
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4"
        >
          <div data-slot="dateRange" className="flex items-center gap-2 !mx-auto">
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={handleDateRangeChange}
              buttonLabel="Rango de fechas"
              ariaLabel="Seleccionar rango de fechas"
            />
          </div>

          <div data-slot="viewTabs" className="flex-1 flex justify-end mx-auto">
            <Tabs
              tabs={MY_SCHEDULE_VIEW_TAB_ITEMS}
              activeId={view}
              onNavigate={(_, id) => handleViewChange(id)}
              ariaLabel="Cambiar vista"
              className="bo-tabs--glass rounded-xl !w-fit !mx-auto"
            />
          </div>
        </div>

        {loading ? (
          <div data-ui="loadingState" className="flex items-center justify-center py-12">
            <Loader2 data-slot="spinner" size={24} strokeWidth={1.8} className="dark:text-white/60 text-purple-400 animate-spin" aria-hidden="true" />
            <span data-slot="label" className="ml-2 dark:text-white/60 text-zinc-500">Cargando horarios...</span>
          </div>
        ) : error ? (
          <div data-ui="errorState" className="text-center py-12 dark:text-red-400 text-red-600">
            {error}
          </div>
        ) : view === "diario" ? (
          <div data-ui="dailyView" className="space-y-4">
            {datesInRange.map((date) => (
              <DailyScheduleCard
                key={date}
                date={date}
                schedule={schedulesByDate.get(date) || null}
              />
            ))}
          </div>
        ) : (
          <WeeklyScheduleTable
            weekGroups={weekGroups}
            schedulesByDate={schedulesByDate}
          />
        )}
      </div>
    </section>
  );
}
