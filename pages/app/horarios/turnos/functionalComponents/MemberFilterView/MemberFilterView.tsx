import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, PanelLeftClose, PanelLeftOpen, User } from "lucide-react";

import { createClient } from "../../../../../../api/client";
import type { Member, FichajeSchedule } from "../../../../../../api/types";
import type { MemberFilterViewProps } from "./types";

import { ScrollArea } from "../../../../../../ui/layout/ScrollArea";
import { ChevronButton } from "../../../../../../ui/widgets/ChevronButton";
import { DateRangePicker } from "../../../../../../ui/inputs/DateRangePicker";
import { DailyScheduleCard } from "./DailyScheduleCard";
import { WeeklyScheduleTable } from "./WeeklyScheduleTable";

import { generateDateRange, getWeekGroups } from "../../helpers";
import { fullName } from "../../../../../../lib/member";

const MEMBER_FILTER_VIEW_KEY = "bo_horarios_preview_member_view";
const MEMBER_SIDEBAR_KEY = "bo_horarios_member_sidebar_open";

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
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => members[0]?.id ?? null);
  const [searchValue, setSearchValue] = useState("");
  const [dateFrom, setDateFrom] = useState(() => todayISO());
  const [dateTo, setDateTo] = useState(() => addDays(todayISO(), 6));
  const [view, setView] = useState<"diario" | "semanal">(getInitialView);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(MEMBER_SIDEBAR_KEY) !== "0";
  });
  const [schedules, setSchedules] = useState<FichajeSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(MEMBER_FILTER_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(MEMBER_SIDEBAR_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  // Always keep a member selected: default to the first one once members are
  // available (props may load asynchronously).
  useEffect(() => {
    if (selectedMemberId == null && members.length > 0) {
      setSelectedMemberId(members[0].id);
    }
  }, [members, selectedMemberId]);

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

  const rangeDays = useMemo(() => {
    if (!dateFrom || !dateTo) return 1;
    const f = new Date(dateFrom);
    const t = new Date(dateTo);
    return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1);
  }, [dateFrom, dateTo]);

  const handlePrevRange = useCallback(() => {
    if (!dateFrom || !dateTo) return;
    setDateFrom(addDays(dateFrom, -rangeDays));
    setDateTo(addDays(dateTo, -rangeDays));
  }, [dateFrom, dateTo, rangeDays]);

  const handleNextRange = useCallback(() => {
    if (!dateFrom || !dateTo) return;
    setDateFrom(addDays(dateFrom, rangeDays));
    setDateTo(addDays(dateTo, rangeDays));
  }, [dateFrom, dateTo, rangeDays]);

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
      className={`flex flex-col gap-4 w-full ${className}`}
    >
      {/* Top controls bar: date range + view switcher, above the whole section */}
      <div
        data-ui="controlsBar"
        className="flex flex-col items-center gap-2"
      >
        <div data-slot="dateRange" className="flex items-center gap-2">
          <ChevronButton direction="left" ariaLabel="Rango anterior" onClick={handlePrevRange} />
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onChange={handleDateRangeChange}
            buttonLabel="Rango de fechas"
            ariaLabel="Seleccionar rango de fechas"
          />
          <ChevronButton direction="right" ariaLabel="Siguiente rango" onClick={handleNextRange} />
        </div>

        {/* Día/Semana switcher */}
        <div data-slot="viewTabs" className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleViewChange("diario")}
            aria-label="Vista diaria"
            title="Día"
            aria-pressed={view === "diario"}
            className={`bo-dateBtn bo-dateBtn--glass !justify-center !px-3 ${view === "diario" ? " !border-violet-500 !text-violet-500 dark:!border-violet-400 dark:!text-violet-300" : ""}`}
          >
            Día
          </button>
          <button
            type="button"
            onClick={() => handleViewChange("semanal")}
            aria-label="Vista semanal"
            title="Semana"
            aria-pressed={view === "semanal"}
            className={`bo-dateBtn bo-dateBtn--glass !justify-center !px-3 ${view === "semanal" ? " !border-violet-500 !text-violet-500 dark:!border-violet-400 dark:!text-violet-300" : ""}`}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Sidebar + schedule area */}
      <div className="flex flex-col md:flex-row gap-4 w-full">
      {sidebarOpen ? (
        /* Member selector sidebar */
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
            <User data-slot="icon" size={16} strokeWidth={1.8} className="sidebar-icon text-[var(--bo-accent)]" aria-hidden="true" />
            <span data-slot="title" className="sidebar-title text-sm font-medium text-purple-900">
              Miembro
            </span>
            <span data-slot="count" className="sidebar-count ml-auto text-xs text-[var(--bo-faint)]">
              {filteredMembers.length}
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Ocultar miembros"
              title="Ocultar miembros"
              className="!inline-flex !h-6 !w-6 items-center justify-center !rounded-none !border-0 !bg-transparent !p-0 text-[var(--bo-faint)] transition-colors hover:text-[var(--bo-text)]"
            >
              <PanelLeftClose size={15} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>

          <div data-slot="searchWrapper" className="relative mb-3">
            <input
              data-ui="memberSearch"
              type="text"
              placeholder="Buscar..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="bo-input w-full"
              aria-label="Buscar miembro"
            />
          </div>

          <ScrollArea dataSlot="memberList" maxHeight={256}>
            <div className="space-y-1">
              {filteredMembers.map((member) => (
                <button
                  key={member.id}
                  data-ui="memberOption"
                  type="button"
                  className={`w-full text-left px-3 py-2 max-sm:min-h-11 rounded-lg text-sm transition-all duration-150 border border-transparent ${
                    selectedMemberId === member.id
                      ? "is-selected bg-[color-mix(in_srgb,var(--bo-accent)_18%,transparent)] border-[var(--bo-accent)] text-[var(--bo-text)] font-medium"
                      : "bg-transparent text-[var(--bo-muted)] hover:bg-[var(--bo-bg-hover)] hover:text-[var(--bo-text)]"
                  }`}
                  onClick={() => handleMemberSelect(member.id)}
                >
                  {fullName(member)}
                </button>
              ))}

              {filteredMembers.length === 0 ? (
                <div data-ui="emptyState" className="text-center py-4 text-sm text-[var(--bo-faint)]">
                  Sin resultados
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </aside>
      ) : null}

      {/* Schedule display area */}
      <div data-ui="scheduleArea" className="flex-1 min-w-0">
        {!sidebarOpen ? (
          /* Collapsed rail: reopen button above the schedule, full width */
          <div className="mb-3 flex" data-slot="sidebarRail">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Mostrar miembros"
              title="Mostrar miembros"
              className="bo-dateBtn bo-dateBtn--glass !justify-center !h-9 !w-9 !p-0"
            >
              <PanelLeftOpen size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        {/* Loading state */}
        {loading ? (
          <div data-ui="loadingState" className="flex items-center justify-center py-12">
            <Loader2 data-slot="spinner" size={24} strokeWidth={1.8} className="text-[var(--bo-muted)] animate-spin" aria-hidden="true" />
            <span data-slot="label" className="ml-2 text-[var(--bo-muted)]">Cargando horarios...</span>
          </div>
        ) : error ? (
          <div data-ui="errorState" className="text-center py-12 dark:text-red-400 text-red-600">
            {error}
          </div>
        ) : !selectedMemberId ? (
          <div data-ui="emptyState" className="text-center py-12 text-[var(--bo-faint)]">
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
    </div>
    </>
  );
}
