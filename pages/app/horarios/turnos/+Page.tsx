import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { ArrowRight, CalendarClock, CalendarDays, Clock, Play, Search, Square } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeActiveEntry, FichajeSchedule, Member, TimeEntry } from "../../../../api/types";

type EditableTimeEntry = {
  id: number;
  startTime: string;
  endTime: string | null;
  minutesWorked: number;
  source: string;
  isLive: boolean;
};
import { fichajeRealtimeAtom } from "../../../../state/atoms";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { CalendarModal } from "./functionalComponents/CalendarModal/CalendarModal";
import { MemberFilterView } from "./functionalComponents/MemberFilterView/MemberFilterView";
import { MemberShiftModal } from "../../../../ui/widgets/MemberShiftModal";
import { HorariosRosterTable, type HorariosRosterRow, type HorariosRosterTableView } from "../../../../ui/widgets/HorariosRosterTable";
import { Panel } from "../../../../ui/shell/Panel";
import { Avatar, AvatarFallback, AvatarImage } from "../../../../ui/shell/Avatar";
import { cn } from "../../../../ui/shadcn/utils";
import { fullName } from "../../../../lib/member";

type PageData = {
  date: string;
  members: Member[];
  schedules: FichajeSchedule[];
  error: string | null;
};

const VIEW_STORAGE_KEY = "bo_horarios_turnos_view";

function parseHHMM(value: string): number | null {
  const [h, m] = value.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function shiftHHMM(value: string, deltaMinutes: number): string | null {
  const current = parseHHMM(value);
  if (current === null) return null;
  const next = current + deltaMinutes;
  if (next < 0 || next > 23 * 60 + 59) return null;
  const h = Math.floor(next / 60);
  const m = next % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toHHMMFromNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDateLabel(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const yyyy = Number(m[1]), mm = Number(m[2]), dd = Number(m[3]);
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return iso;
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function scheduleHours(startTime: string, endTime: string): string {
  const s = startTime.split(":").map(Number);
  const e = endTime.split(":").map(Number);
  if (!s[0] || !e[0]) return "";
  const mins = (e[0] * 60 + e[1]) - (s[0] * 60 + s[1]);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: todayISO(),
    members: [],
    schedules: [],
    error: null,
  }) as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const realtime = useAtomValue(fichajeRealtimeAtom);

  const [date, setDate] = useState(data.date || todayISO());
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules || []);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => {
    const raw = Number(pageContext.urlParsed?.search?.memberId ?? 0);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return data.members[0]?.id ?? null;
  });
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyEntryId, setBusyEntryId] = useState<number | null>(null);
  const [busyFichaje, setBusyFichaje] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  const { pushToast } = useToasts();
  useErrorToast(error);
  const [view, setView] = useState<HorariosRosterTableView>(() => {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (stored === "table" || stored === "grid") return stored;
    } catch {
      // ignore
    }
    return "grid";
  });
  const [shiftModalMember, setShiftModalMember] = useState<Member | null>(null);
  const [shiftModalOpen, setShiftModalOpen] = useState(false);

  const membersSorted = useMemo(
    () => [...(data.members || [])].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })),
    [data.members],
  );

  const scheduleByMember = useMemo(() => {
    const out = new Map<number, FichajeSchedule>();
    for (const schedule of schedules) out.set(schedule.memberId, schedule);
    return out;
  }, [schedules]);

  const activeEntriesForDate = useMemo(() => {
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [date, realtime.activeEntriesByMember]);

  const selectedMember = useMemo(
    () => membersSorted.find((member) => member.id === selectedMemberId) || null,
    [membersSorted, selectedMemberId],
  );

  const selectedSchedule = useMemo(
    () => (selectedMember ? scheduleByMember.get(selectedMember.id) : undefined),
    [scheduleByMember, selectedMember],
  );

  const editableEntries = useMemo<EditableTimeEntry[]>(
    () =>
      entries.map((entry) => ({
        id: entry.id,
        startTime: entry.startTime,
        endTime: entry.endTime,
        minutesWorked: entry.minutesWorked,
        source: entry.source,
        isLive: entry.endTime === null,
      })),
    [entries],
  );

  const syncURL = useCallback((nextDate: string, nextMemberId: number | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set("date", nextDate);
    if (nextMemberId) url.searchParams.set("memberId", String(nextMemberId));
    else url.searchParams.delete("memberId");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const loadSchedules = useCallback(
    async (nextDate: string) => {
      const res = await api.horarios.list(nextDate);
      if (!res.success) throw new Error(res.message || "No se pudieron cargar horarios");
      setSchedules(res.schedules);
    },
    [api.horarios],
  );

  const loadEntries = useCallback(
    async (nextDate: string, nextMemberId: number | null) => {
      if (!nextMemberId) {
        setEntries([]);
        return;
      }
      const res = await api.fichaje.entries.list({ date: nextDate, memberId: nextMemberId });
      if (!res.success) throw new Error(res.message || "No se pudieron cargar registros");
      setEntries(res.entries);
    },
    [api.fichaje.entries],
  );

  const selectDate = useCallback(
    async (nextDate: string) => {
      setDate(nextDate);
      syncURL(nextDate, selectedMemberId);
      setLoading(true);
      setError(null);
      try {
        await Promise.all([loadSchedules(nextDate), loadEntries(nextDate, selectedMemberId)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la fecha");
      } finally {
        setLoading(false);
      }
    },
    [loadEntries, loadSchedules, selectedMemberId, syncURL],
  );

  const selectMember = useCallback(
    async (memberId: number) => {
      setSelectedMemberId(memberId);
      syncURL(date, memberId);
      setLoading(true);
      setError(null);
      try {
        await loadEntries(date, memberId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el miembro");
      } finally {
        setLoading(false);
      }
    },
    [date, loadEntries, syncURL],
  );

  const refreshMemberEntries = useCallback(async () => {
    await loadEntries(date, selectedMemberId);
  }, [date, loadEntries, selectedMemberId]);

  const patchEntry = useCallback(
    async (entryId: number, payload: { startTime?: string; endTime?: string }) => {
      setBusyEntryId(entryId);
      setError(null);
      try {
        const res = await api.fichaje.entries.patch(entryId, payload);
        if (!res.success) {
          setError(res.message || "No se pudo actualizar el registro");
          return;
        }
        await refreshMemberEntries();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar el registro");
      } finally {
        setBusyEntryId(null);
      }
    },
    [api.fichaje.entries, refreshMemberEntries],
  );

  const onShiftStart = useCallback(
    (entryId: number, deltaMinutes: number) => {
      const entry = editableEntries.find((item) => item.id === entryId);
      if (!entry) return;
      const nextStart = shiftHHMM(entry.startTime, deltaMinutes);
      if (!nextStart) return;
      if (entry.endTime) {
        const nextStartM = parseHHMM(nextStart);
        const endM = parseHHMM(entry.endTime);
        if (nextStartM === null || endM === null || nextStartM >= endM) {
          pushToast({ kind: "error", title: "Horario invalido", message: "La hora de inicio debe ser menor que la de fin" });
          return;
        }
      }
      void patchEntry(entryId, { startTime: nextStart });
    },
    [editableEntries, patchEntry, pushToast],
  );

  const onShiftEnd = useCallback(
    (entryId: number, deltaMinutes: number) => {
      const entry = editableEntries.find((item) => item.id === entryId);
      if (!entry || !entry.endTime) return;
      const nextEnd = shiftHHMM(entry.endTime, deltaMinutes);
      if (!nextEnd) return;
      const startM = parseHHMM(entry.startTime);
      const nextEndM = parseHHMM(nextEnd);
      if (startM === null || nextEndM === null || nextEndM <= startM) {
        pushToast({ kind: "error", title: "Horario invalido", message: "La hora de fin debe ser mayor que la de inicio" });
        return;
      }
      void patchEntry(entryId, { endTime: nextEnd });
    },
    [editableEntries, patchEntry, pushToast],
  );

  const onCloseLive = useCallback(
    (entryId: number) => {
      void patchEntry(entryId, { endTime: toHHMMFromNow() });
    },
    [patchEntry],
  );

  const startFichaje = useCallback(async () => {
    if (!selectedMemberId || !selectedSchedule) return;
    setBusyFichaje(true);
    try {
      const res = await api.fichaje.adminStart(selectedMemberId);
      if (res.success) {
        await refreshMemberEntries();
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al iniciar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al iniciar" });
    } finally {
      setBusyFichaje(false);
    }
  }, [selectedMemberId, selectedSchedule, api.fichaje, refreshMemberEntries, pushToast]);

  const stopFichaje = useCallback(async () => {
    if (!selectedMemberId) return;
    setBusyFichaje(true);
    try {
      const res = await api.fichaje.adminStop(selectedMemberId);
      if (res.success) {
        await refreshMemberEntries();
        pushToast({ kind: "success", title: "Fichaje terminado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al terminar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al terminar" });
    } finally {
      setBusyFichaje(false);
    }
  }, [selectedMemberId, api.fichaje, refreshMemberEntries, pushToast]);

  const isMemberActive = useMemo(
    () => selectedMemberId ? activeEntriesForDate.has(selectedMemberId) : false,
    [selectedMemberId, activeEntriesForDate],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    } catch {
      // ignore
    }
  }, [view]);

  React.useEffect(() => {
    void loadEntries(date, selectedMemberId).catch((err) => {
      setError(err instanceof Error ? err.message : "No se pudieron cargar registros");
    });
  }, [date, loadEntries, selectedMemberId]);

  const tableMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return membersSorted;
    return membersSorted.filter((member) => fullName(member).toLowerCase().includes(query));
  }, [memberSearch, membersSorted]);

  const rosterRows = useMemo<HorariosRosterRow[]>(
    () =>
      tableMembers.map((member) => ({
        member,
        schedule: scheduleByMember.get(member.id),
        activeEntry: activeEntriesForDate.get(member.id),
      })),
    [activeEntriesForDate, scheduleByMember, tableMembers],
  );

  const onRosterSelect = useCallback(
    (member: Member) => {
      void selectMember(member.id);
    },
    [selectMember],
  );

  const onOpenShiftModal = useCallback((member: Member) => {
    setShiftModalMember(member);
    setShiftModalOpen(true);
  }, []);

  const onCloseShiftModal = useCallback(() => {
    setShiftModalOpen(false);
    setShiftModalMember(null);
  }, []);

  return (
    <section aria-label="Edicion de turnos" className="bo-turnosPage" data-testid="horarios-turnos-section">
      <Panel
        data-testid="horarios-turnos-panel"
        title={
          <span className="bo-horariosTitle" data-testid="horarios-turnos-title">
            <CalendarClock size={16} strokeWidth={1.8} />
            Turnos
          </span>
        }
        meta="Editar tiempo registrado por miembro y fecha."
        actions={
          <div className="bo-horariosPreviewActions" data-testid="horarios-turnos-actions">
            <button
              type="button"
              className="bo-dateBtn bo-dateBtn--glass"
              onClick={() => setCalendarModalOpen(true)}
              data-testid="horarios-turnos-calendar-btn"
            >
              <CalendarDays size={18} strokeWidth={1.8} />
              <span className="bo-dateBtnLabel">{formatDateLabel(date)}</span>
            </button>
            <CalendarModal
              open={calendarModalOpen}
              onClose={() => setCalendarModalOpen(false)}
              onSelectDate={(nextDate) => void selectDate(nextDate)}
              year={Number(date.split("-")[0])}
              month={Number(date.split("-")[1])}
              currentDate={date}
            />
            <div className="bo-tabs bo-tabs--glass bo-viewTabs !w-fit !ms-auto" role="tablist" aria-label="Cambiar vista" data-testid="horarios-turnos-view-tabs">
              <button
                type="button"
                className={cn("bo-tab", view === "grid" && "is-active")}
                role="tab"
                aria-selected={view === "grid"}
                onClick={() => setView("grid")}
                data-testid="horarios-turnos-view-grid"
              >
                {view === "grid" ? <span className="bo-tabIndicator" /> : null}
                <span className="bo-tabInner" data-slot="turnos-tabInner">
                  <span className="bo-tabLabel" data-slot="turnos-tabLabel">Grid</span>
                </span>
              </button>
              <button
                type="button"
                className={cn("bo-tab", view === "table" && "is-active")}
                role="tab"
                aria-selected={view === "table"}
                onClick={() => setView("table")}
                data-testid="horarios-turnos-view-table"
              >
                {view === "table" ? <span className="bo-tabIndicator" /> : null}
                <span className="bo-tabInner" data-slot="turnos-tabInner">
                  <span className="bo-tabLabel" data-slot="turnos-tabLabel">Tabla</span>
                </span>
              </button>
              <button
                type="button"
                className={cn("bo-tab", view === "member" && "is-active")}
                role="tab"
                aria-selected={view === "member"}
                onClick={() => setView("member")}
                data-testid="horarios-turnos-view-member"
              >
                {view === "member" ? <span className="bo-tabIndicator" /> : null}
                <span className="bo-tabInner" data-slot="turnos-tabInner">
                  <span className="bo-tabLabel" data-slot="turnos-tabLabel">Miembro</span>
                </span>
              </button>
            </div>
          </div>
        }
        bodyClassName="bo-turnosBody"
      >

          {view === "grid" ? (
          <div className="flex flex-wrap justify-center gap-3">
            {membersSorted.map((member) => {
              const sched = scheduleByMember.get(member.id);
              const isLive = activeEntriesForDate.has(member.id);
              return (
                <div
                  key={member.id}
                  className="flex flex-col justify-between rounded-xl bg-transparent p-4 w-[calc(25%-12px)] min-w-[200px] h-[120px] transition-colors duration-200"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                  data-testid="turnos-member-card"
                >
                  <div className="flex items-center gap-3" data-ui="card-header">
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-10 h-10 rounded-full">
                        {member.photoUrl ? <AvatarImage src={member.photoUrl} alt={fullName(member)} /> : null}
                        <AvatarFallback className="text-xs font-bold">{initials(fullName(member))}</AvatarFallback>
                      </Avatar>
                      {isLive ? (
                        <span
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--bo-bg)]"
                          style={{ background: "var(--bo-color-success)" }}
                          data-ui="card-live-dot"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-tight truncate text-[var(--bo-text)]">
                        {fullName(member)}
                      </div>
                      <div className="text-[11px] leading-tight mt-0.5 text-[var(--bo-faint)]">
                        {isLive ? "En curso" : sched ? "Programado" : "Sin asignar"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2" data-ui="card-footer">
                    {sched ? (
                      <>
                        <div className="flex items-center gap-1.5" data-ui="card-times">
                          <Clock size={13} strokeWidth={1.8} className="text-[var(--bo-muted)]" />
                          <span className="text-xs font-semibold tabular-nums text-[var(--bo-text)]">{sched.startTime}</span>
                          <ArrowRight size={11} strokeWidth={1.8} className="text-[var(--bo-faint)]" />
                          <span className="text-xs font-semibold tabular-nums text-[var(--bo-text)]">{sched.endTime}</span>
                        </div>
                        <span className="text-[11px] font-medium text-[var(--bo-muted)]">{scheduleHours(sched.startTime, sched.endTime)}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-[var(--bo-faint)] italic">Sin horario</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          ) : view === "table" ? (
            <section className="bo-turnosRoster" aria-label="Tabla de miembros" data-testid="horarios-turnos-roster">
              <div className="bo-turnosRosterHead" data-testid="horarios-turnos-roster-head">
                <div className="bo-panelTitle" data-testid="horarios-turnos-roster-title">Miembros</div>
                <div className="bo-memberPickerCount" data-testid="horarios-turnos-roster-count">{tableMembers.length}</div>
              </div>
              <label className="bo-memberPickerSearch bo-memberPickerSearch--glass" aria-label="Buscar miembro" data-testid="horarios-turnos-search-label">
                <Search size={14} strokeWidth={1.8} />
                <input
                  type="text"
                  className="bo-memberPickerSearchInput"
                  value={memberSearch}
                  onChange={(ev) => setMemberSearch(ev.target.value)}
                  placeholder="Buscar..."
                  data-testid="horarios-turnos-search-input"
                />
              </label>
              <HorariosRosterTable
                rows={rosterRows}
                selectedMemberId={selectedMemberId}
                onRowClick={onRosterSelect}
                onEditMember={onOpenShiftModal}
                ariaLabel="Tabla de horarios (turnos)"
              />
            </section>
          ) : view === "member" ? (
            <MemberFilterView members={membersSorted} />
          ) : null}
        </Panel>

      {shiftModalMember ? (
        <MemberShiftModal member={shiftModalMember} selectedDate={date} open={shiftModalOpen} onClose={onCloseShiftModal} />
      ) : null}
    </section>
  );
}
