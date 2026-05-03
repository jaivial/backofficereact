import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, User, CalendarRange } from "lucide-react";

import { createClient } from "../../../../../../api/client";
import type { Member, FichajeSchedule } from "../../../../../../api/types";
import type { MemberFilterViewProps } from "./types";

import { Tabs } from "../../../../../../ui/nav/Tabs";
import { DateRangePicker } from "../../../../../../ui/inputs/DateRangePicker";
import { DailyScheduleCard } from "./DailyScheduleCard";
import { WeeklyScheduleTable } from "./WeeklyScheduleTable";

import { generateDateRange, getWeekGroups } from "../../helpers";
import { fullName } from "../../../../../../lib/member";

const MEMBER_VIEW_TAB_ITEMS = [
  { id: "diario", label: "Diario" },
  { id: "semanal", label: "Semanal" },
];

const MEMBER_FILTER_VIEW_KEY = "bo_horarios_preview_member_view";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getInitialView(): "diario" | "semanal" {
  if (typeof window === "undefined") return "diario";
  const stored = localStorage.getItem(MEMBER_FILTER_VIEW_KEY);
  if (stored === "diario" || stored === "semanal") return stored;
  return "diario";
}

export function MemberFilterView({ members, className }: MemberFilterViewProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState(() => todayISO());
  const [dateTo, setDateTo] = useState(() => addDays(todayISO(), 6));
  const [view, setView] = useState<"diario" | "semanal">(getInitialView);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(MEMBER_FILTER_VIEW_KEY, view);
  }, [view]);

  const filteredMembers = useMemo(() => {
    if (!searchValue.trim()) return members;
    const q = searchValue.toLowerCase();
    return members.filter((m) => fullName(m).toLowerCase().includes(q));
  }, [members, searchValue]);

  useEffect(() => {
    if (!selectedMemberId || !dateFrom || !dateTo) {
      setSchedules([]);
      return;
    }

    const controller = new AbortController();

    async function fetchSchedules() {
      setLoading(true);
      setError(null);

      try {
        const result = await api.horarios.listByMemberRange({
          memberId: selectedMemberId!,
          from: dateFrom,
          to: dateTo,
        });

        if (result.success) {
          setSchedules(result.schedules || []);
        } else {
          setError(result.message || "Error al obtener horarios");
          setSchedules([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al obtener horarios");
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    }

    fetchSchedules();

    return () => controller.abort();
  }, [selectedMemberId, dateFrom, dateTo]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, FichajeSchedule>();
    for (const s of schedules) {
      if (s.date) map.set(s.date, s);
    }
    return map;
  }, [schedules]);

  const datesInRange = useMemo(
    () => (dateFrom && dateTo ? generateDateRange(dateFrom, dateTo) : []),
    [dateFrom, dateTo]
  );

  const weekGroups = useMemo(
    () => getWeekGroups(datesInRange),
    [datesInRange]
  );

  const handleMemberSelect = useCallback((id: number) => {
    setSelectedMemberId(id);
  }, []);

  const handleDateRangeChange = useCallback((next: { from: string; to: string }) => {
    setDateFrom(next.from);
    setDateTo(next.to);
  }, []);

  const handleViewChange = useCallback((id: string) => {
    setView(id as "diario" | "semanal");
  }, []);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  return (
    <>
      <style>{`
        [data-theme="dark"] [data-ui="memberSidebar"] {
          background: linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 10%, transparent), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.16)),
            color-mix(in srgb, var(--bo-surface-2) 78%, transparent) !important;
          border-color: var(--bo-glass-border-strong) !important;
          box-shadow: var(--bo-glass-shadow) !important;
          backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
          -webkit-backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
        }
        [data-theme="dark"] [data-ui="memberSidebar"] .sidebar-title { color: rgba(255,255,255,0.80); }
        [data-theme="dark"] [data-ui="memberSidebar"] .sidebar-count { color: rgba(255,255,255,0.50); }
        [data-theme="dark"] [data-ui="memberSidebar"] .sidebar-icon { color: rgba(255,255,255,0.60); }
        [data-theme="dark"] [data-ui="memberSidebar"] input[type="text"] {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.10);
          color: rgba(255,255,255,0.90);
        }
        [data-theme="dark"] [data-ui="memberSidebar"] input[type="text"]::placeholder { color: rgba(255,255,255,0.40); }
        [data-theme="dark"] [data-ui="memberSidebar"] input[type="text"]:focus {
          border-color: rgba(255,255,255,0.30);
        }
        [data-theme="dark"] [data-ui="memberSidebar"] [data-ui="memberOption"]:not(.is-selected) {
          background: transparent !important;
          color: rgba(255,255,255,0.50);
          border-color: transparent !important;
        }
        [data-theme="dark"] [data-ui="memberSidebar"] [data-ui="memberOption"]:not(.is-selected):hover {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.90);
        }
        [data-theme="dark"] [data-ui="memberSidebar"] [data-ui="memberOption"].is-selected {
          background: color-mix(in srgb, var(--bo-accent) 20%, transparent) !important;
          border-color: color-mix(in srgb, var(--bo-accent) 40%, transparent) !important;
          color: rgba(255,255,255,0.90) !important;
        }
        [data-theme="dark"] [data-ui="memberSidebar"] [data-ui="emptyState"] { color: rgba(255,255,255,0.40); }
      `}</style>
    <div
      data-ui="memberFilterView"
      className={`flex flex-col md:flex-row gap-4 ${className}`}
    >
      {/* Member selector sidebar */}
      <aside
        data-ui="memberSidebar"
        className="w-full md:w-64 flex-shrink-0 rounded-xl p-4 border border-solid"
        aria-label="Selector de miembro"
        style={{
          background: "linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 8%, white), transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(242, 244, 251, 0.76)), color-mix(in srgb, var(--bo-surface) 90%, transparent)",
          boxShadow: "0 8px 24px rgba(124, 92, 231, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)",
          borderColor: "color-mix(in srgb, var(--bo-accent) 16%, var(--bo-border))",
        }}
      >
        <div data-slot="sidebarHeader" className="flex items-center gap-2 mb-3">
          <User data-slot="icon" size={16} strokeWidth={1.8} className="sidebar-icon text-purple-400" aria-hidden="true" />
          <span data-slot="title" className="sidebar-title text-sm font-medium text-purple-900">
            Miembro
          </span>
          <span data-slot="count" className="sidebar-count ml-auto text-xs text-zinc-400">
            {filteredMembers.length}
          </span>
        </div>

        <div data-slot="searchWrapper" className="relative mb-3">
          <input
            data-ui="memberSearch"
            type="text"
            placeholder="Buscar..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm transition-colors border border-solid bg-white border-zinc-300 text-zinc-800 placeholder:text-zinc-400 focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400/30"
            aria-label="Buscar miembro"
          />
        </div>

        <div data-slot="memberList" className="space-y-1 max-h-64 overflow-y-auto">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              data-ui="memberOption"
              type="button"
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 border border-transparent ${
                selectedMemberId === member.id
                  ? "is-selected bg-purple-100 border-purple-200 text-purple-700 font-medium"
                  : "bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
              onClick={() => handleMemberSelect(member.id)}
            >
              {fullName(member)}
            </button>
          ))}

          {filteredMembers.length === 0 ? (
            <div data-ui="emptyState" className="text-center py-4 text-sm text-zinc-400">
              Sin resultados
            </div>
          ) : null}
        </div>
      </aside>

      {/* Schedule display area */}
      <div data-ui="scheduleArea" className="flex-1 min-w-0">
        {/* Controls bar */}
        <div
          data-ui="controlsBar"
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4"
        >
          <div data-slot="dateRange" className="flex items-center gap-2">
            <CalendarRange data-slot="icon" size={16} strokeWidth={1.8} className="dark:text-white/60 text-purple-400" aria-hidden="true" />
            <DateRangePicker
              from={dateFrom}
              to={dateTo}
              onChange={handleDateRangeChange}
              buttonLabel="Rango de fechas"
              ariaLabel="Seleccionar rango de fechas"
            />
          </div>

          <div data-slot="viewTabs" className="flex-1 flex justify-end">
            <Tabs
              tabs={MEMBER_VIEW_TAB_ITEMS}
              activeId={view}
              onNavigate={(_, id) => handleViewChange(id)}
              ariaLabel="Cambiar vista"
              className="bo-tabs--glass rounded-xl !w-fit"
            />
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div data-ui="loadingState" className="flex items-center justify-center py-12">
            <Loader2 data-slot="spinner" size={24} strokeWidth={1.8} className="dark:text-white/60 text-purple-400 animate-spin" aria-hidden="true" />
            <span data-slot="label" className="ml-2 dark:text-white/60 text-zinc-500">Cargando horarios...</span>
          </div>
        ) : error ? (
          <div data-ui="errorState" className="text-center py-12 dark:text-red-400 text-red-600">
            {error}
          </div>
        ) : !selectedMemberId ? (
          <div data-ui="emptyState" className="text-center py-12 dark:text-white/40 text-zinc-400">
            Selecciona un miembro para ver su horario
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
    </div>
    </>
  );
}
