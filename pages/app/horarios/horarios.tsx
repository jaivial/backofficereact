import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, CalendarDays, Clock3, TableProperties, UserRoundPlus, Users } from "lucide-react";

import { createClient } from "../../../api/client";
import type { CalendarDay, FichajeActiveEntry, FichajeSchedule, HorarioMonthPoint, HorariosCalendarDay, Member } from "../../../api/types";
import { fichajeRealtimeAtom } from "../../../state/atoms";
import type { Data } from "./+data";
import { MonthCalendar } from "../../../ui/widgets/MonthCalendar";
import { ScheduleDayTooltip } from "../../../ui/widgets/ScheduleDayTooltip";
import { useToasts } from "../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { diffLabel, elapsedForEntry, fullName, fromMinutes, monthCalendarData, splitHHMM, todayISO, toMinutes } from "./utils";
import { HOUR_OPTIONS, MINUTE_OPTIONS, HorariosCalendarTab } from "./constants";
import { MyScheduleView } from "./functionalComponents/MyScheduleView/MyScheduleView";
import { ScheduleModal } from "./functionalComponents/ScheduleModal/ScheduleModal";
import { TurnosView } from "./turnos/TurnosView";
import { Panel } from "../../../ui/shell/Panel";
import { ScrollArea } from "../../../ui/layout/ScrollArea";
import { cn } from "../../../ui/shadcn/utils";

export default function Page() {
  const pageContext = usePageContext();
  const data = (pageContext.data ?? {
    date: todayISO(),
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    members: [],
    schedules: [],
    monthDays: [],
    bookingMonthDays: [],
    error: null,
    isAdmin: true,
  }) as Data;

  if (data.isAdmin === false) {
    return <MyScheduleView initialSchedules={data.schedules} />;
  }

  return <AdminHorariosView data={data} />;
}

type TablePanelTab = "tabla" | "turnos";

function AdminHorariosView({ data }: { data: Data }) {
  const pageContext = usePageContext();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const setRealtime = useSetAtom(fichajeRealtimeAtom);
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (realtime.pendingScheduleUpdates && !busy) {
      setRealtime((prev) => ({ ...prev, pendingScheduleUpdates: false }));
    }
  }, [realtime.pendingScheduleUpdates, busy, setRealtime]);

  const [selectedDate, setSelectedDate] = useState(data.date || todayISO());
  const [year, setYear] = useState(data.year);
  const [month, setMonth] = useState(data.month);
  const [members] = useState<Member[]>(data.members);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules);
  const [monthDays, setMonthDays] = useState<HorarioMonthPoint[]>(data.monthDays);
  const [calendarDetail, setCalendarDetail] = useState<HorariosCalendarDay[]>([]);
  const [bookingMonthDays, setBookingMonthDays] = useState<CalendarDay[]>(data.bookingMonthDays);
  const [calendarTab, setCalendarTab] = useState<HorariosCalendarTab>("miembros");
  const initialTablePanelTab: TablePanelTab =
    (pageContext.urlParsed?.search?.tab === "turnos" ? "turnos" : "tabla");
  const [tablePanelTab, setTablePanelTab] = useState<TablePanelTab>(initialTablePanelTab);
  const [memberSearch, setMemberSearch] = useState("");
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [tick, setTick] = useState(() => Date.now());

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [entryHour, setEntryHour] = useState("09");
  const [entryMinute, setEntryMinute] = useState("00");
  const [exitHour, setExitHour] = useState("17");
  const [exitMinute, setExitMinute] = useState("00");
  const calendarViewportRef = useRef<HTMLDivElement | null>(null);
  const [calendarHeight, setCalendarHeight] = useState<number | null>(null);

  const membersSorted = useMemo(
    () => [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" })),
    [members],
  );

  const schedulesByMember = useMemo(() => {
    const out = new Map<number, FichajeSchedule>();
    for (const schedule of schedules) out.set(schedule.memberId, schedule);
    return out;
  }, [schedules]);

  const membersAvailableForSchedule = useMemo(
    () => membersSorted.filter((member) => !schedulesByMember.has(member.id)),
    [membersSorted, schedulesByMember],
  );

  const filteredMembers = useMemo(() => {
    const query = memberSearch.toLowerCase().trim();
    if (!query) return membersAvailableForSchedule;
    return membersAvailableForSchedule.filter((m) => fullName(m).toLowerCase().includes(query));
  }, [memberSearch, membersAvailableForSchedule]);

  const calendarDays = useMemo(
    () => monthCalendarData(year, month, monthDays, membersSorted.length),
    [year, month, monthDays, membersSorted.length],
  );

  const activeEntriesForDate = useMemo(() => {
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== selectedDate) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [realtime.activeEntriesByMember, selectedDate]);

  const extraActiveEntries = useMemo(
    () => Array.from(activeEntriesForDate.values()).filter((entry) => !schedulesByMember.has(entry.memberId)),
    [activeEntriesForDate, schedulesByMember],
  );

  useEffect(() => {
    if (activeEntriesForDate.size === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeEntriesForDate.size]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = calendarViewportRef.current;
    if (!viewport) return;

    let frameId = 0;
    const updateCalendarHeight = () => {
      const calendar = viewport.querySelector<HTMLElement>(".bo-mcal");
      if (!calendar) {
        setCalendarHeight(null);
        return;
      }
      const nextHeight = Math.round(calendar.getBoundingClientRect().height);
      setCalendarHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };

    const resizeObserver = new ResizeObserver(() => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateCalendarHeight);
    });
    resizeObserver.observe(viewport);

    updateCalendarHeight();
    window.addEventListener("resize", updateCalendarHeight);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateCalendarHeight);
    };
  }, []);

  const loadDay = useCallback(
    async (dateISO: string) => {
      const res = await api.horarios.list(dateISO);
      if (!res.success) throw new Error(res.message || "No se pudo cargar horarios del dia");
      setSchedules(res.schedules);
    },
    [api.horarios],
  );

  const loadScheduleMonth = useCallback(
    async (y: number, m: number) => {
      const res = await api.horarios.month({ year: y, month: m });
      if (!res.success) throw new Error(res.message || "No se pudo cargar mes de horarios");
      setMonthDays(res.days);
    },
    [api.horarios],
  );

  const loadCalendarDetail = useCallback(
    async (y: number, m: number) => {
      try {
        const res = await api.horarios.calendar({ year: y, month: m });
        if (res.success) setCalendarDetail(res.days);
      } catch {
        // tooltip detail is non-critical
      }
    },
    [api.horarios],
  );

  useEffect(() => {
    void loadCalendarDetail(year, month);
  }, [loadCalendarDetail, year, month]);

  const loadBookingMonth = useCallback(
    async (y: number, m: number) => {
      const res = await api.calendar.getMonth({ year: y, month: m });
      if (!res.success) throw new Error(res.message || "No se pudo cargar mes de reservas");
      setBookingMonthDays(res.data);
    },
    [api.calendar],
  );

  const syncDate = useCallback((dateISO: string) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("date", dateISO);
    window.history.replaceState(null, "", url.toString());
  }, []);

  const selectTablePanelTab = useCallback((tab: TablePanelTab) => {
    setTablePanelTab(tab);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (tab === "turnos") url.searchParams.set("tab", "turnos");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url.toString());
  }, []);

  const selectDate = useCallback(
    async (dateISO: string) => {
      setBusy(true);
      setError(null);
      try {
        setSelectedDate(dateISO);
        syncDate(dateISO);
        const [y, m] = dateISO.split("-").map((v) => Number(v));
        if (y !== year || m !== month) {
          setYear(y);
          setMonth(m);
          await Promise.all([loadDay(dateISO), loadScheduleMonth(y, m), loadBookingMonth(y, m)]);
        } else {
          await loadDay(dateISO);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la fecha seleccionada");
      } finally {
        setBusy(false);
      }
    },
    [loadBookingMonth, loadDay, loadScheduleMonth, month, syncDate, year],
  );

  const moveMonth = useCallback(
    async (delta: -1 | 1) => {
      const nextDate = new Date(year, month - 1 + delta, 1);
      const nextYear = nextDate.getFullYear();
      const nextMonth = nextDate.getMonth() + 1;
      setBusy(true);
      setError(null);
      try {
        setYear(nextYear);
        setMonth(nextMonth);
        await Promise.all([loadScheduleMonth(nextYear, nextMonth), loadBookingMonth(nextYear, nextMonth)]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el mes");
      } finally {
        setBusy(false);
      }
    },
    [loadBookingMonth, loadScheduleMonth, month, year],
  );

  const openMemberModal = useCallback(
    (member: Member) => {
      setSelectedMember(member);
      const existing = schedulesByMember.get(member.id);
      const inTime = splitHHMM(existing?.startTime || "09:00");
      const outTime = splitHHMM(existing?.endTime || "17:00");
      setEntryHour(inTime.h);
      setEntryMinute(inTime.m);
      setExitHour(outTime.h);
      setExitMinute(outTime.m);
      setModalOpen(true);
    },
    [schedulesByMember],
  );

  const saveSchedule = useCallback(async () => {
    if (!selectedMember) return;
    const startTime = `${entryHour}:${entryMinute}`;
    const normalizedExitMinutes = Math.max(toMinutes(entryHour, entryMinute), toMinutes(exitHour, exitMinute));
    const normalizedExit = fromMinutes(normalizedExitMinutes);
    const endTime = `${normalizedExit.h}:${normalizedExit.m}`;

    if (normalizedExit.h !== exitHour || normalizedExit.m !== exitMinute) {
      setExitHour(normalizedExit.h);
      setExitMinute(normalizedExit.m);
    }

    setBusy(true);
    setError(null);
    try {
      const res = await api.horarios.assign({
        date: selectedDate,
        memberId: selectedMember.id,
        startTime,
        endTime,
      });
      if (!res.success) {
        setError(res.message || "No se pudo asignar el horario");
        return;
      }
      await Promise.all([loadDay(selectedDate), loadScheduleMonth(year, month)]);
      pushToast({ kind: "success", title: "Horario asignado" });
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo asignar el horario");
    } finally {
      setBusy(false);
    }
  }, [api.horarios, entryHour, entryMinute, exitHour, exitMinute, loadDay, loadScheduleMonth, month, pushToast, selectedDate, selectedMember, year]);

  const setEntryTime = useCallback(
    (nextHour: string, nextMinute: string) => {
      if (nextHour !== entryHour) setEntryHour(nextHour);
      if (nextMinute !== entryMinute) setEntryMinute(nextMinute);

      const nextEntryMinutes = toMinutes(nextHour, nextMinute);
      const currentExitMinutes = toMinutes(exitHour, exitMinute);
      if (nextEntryMinutes <= currentExitMinutes) return;

      const fixed = fromMinutes(nextEntryMinutes);
      if (fixed.h !== exitHour) setExitHour(fixed.h);
      if (fixed.m !== exitMinute) setExitMinute(fixed.m);
    },
    [entryHour, entryMinute, exitHour, exitMinute],
  );

  const activeCalendarDays = calendarTab === "miembros" ? calendarDays : bookingMonthDays;

  const calendarDetailByDate = useMemo(() => {
    const map = new Map<string, HorariosCalendarDay>();
    for (const day of calendarDetail) map.set(day.date, day);
    return map;
  }, [calendarDetail]);

  const renderDayTooltip = useCallback(
    (dateISO: string) => {
      const dayData = calendarDetailByDate.get(dateISO);
      if (!dayData) return null;
      return <ScheduleDayTooltip dayData={dayData} />;
    },
    [calendarDetailByDate],
  );
  const calendarTransition = reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeInOut" as const };
  const calendarRowStyle = useMemo(
    () =>
      ({
        "--bo-horarios-mcal-height": calendarHeight ? `${calendarHeight}px` : "480px",
      }) as React.CSSProperties,
    [calendarHeight],
  );

  return (
    <section aria-label="Horarios" className="bo-content-grid bo-horariosPage" data-ui="horarios-page">
      <div className="bo-horariosTopGrid" data-slot="top-grid">
        <Panel
          className="bo-horariosCalendarPanel"
          data-slot="calendar-panel"
          title={
            <span className="bo-horariosTitle" data-slot="panel-title">
              <CalendarClock size={16} strokeWidth={1.8} data-role="calendar-clock-icon" aria-hidden="true" />
              <span data-slot="title-text">Horarios</span>
              {realtime.pendingScheduleUpdates && (
                <span className="bo-pendingDot" title="Hay cambios sin ver" data-role="pending-dot" />
              )}
            </span>
          }
          meta="Selecciona una fecha y asigna turnos al equipo."
          actions={<div className="bo-horariosDate-badge" data-slot="date-badge">{selectedDate}</div>}
          bodyClassName="bo-horariosCalendarBody"
        >
            <div className="bo-tabs bo-horariosCalendarTabs !w-fit mx-auto" role="tablist" aria-label="Calendario de miembros y reservas" data-slot="calendar-tabs">
              <button
                type="button"
                className={`bo-tab bo-horariosCalendarTab${calendarTab === "miembros" ? " is-active" : ""}`}
                role="tab"
                aria-selected={calendarTab === "miembros"}
                onClick={() => setCalendarTab("miembros")}
                data-slot="tab-miembros"
              >
                {calendarTab === "miembros" ? <span className="bo-tabIndicator" data-role="tab-indicator" /> : null}
                <span className="bo-tabInner" data-slot="tab-inner">
                  <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon">
                    <Users size={16} strokeWidth={1.8} data-role="users-icon" />
                  </span>
                  <span className="bo-tabLabel" data-slot="tab-label">Miembros</span>
                </span>
              </button>
              <button
                type="button"
                className={`bo-tab bo-horariosCalendarTab${calendarTab === "reservas" ? " is-active" : ""}`}
                role="tab"
                aria-selected={calendarTab === "reservas"}
                onClick={() => setCalendarTab("reservas")}
                data-slot="tab-reservas"
              >
                {calendarTab === "reservas" ? <span className="bo-tabIndicator" data-role="tab-indicator" /> : null}
                <span className="bo-tabInner" data-slot="tab-inner">
                  <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon">
                    <CalendarDays size={16} strokeWidth={1.8} data-role="calendar-days-icon" />
                  </span>
                  <span className="bo-tabLabel" data-slot="tab-label">Reservas</span>
                </span>
              </button>
            </div>

            <div className="bo-horariosCalendarRow" style={calendarRowStyle} data-slot="calendar-row">
              <div className="bo-horariosCalendarViewport" ref={calendarViewportRef} data-slot="calendar-viewport">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={calendarTab}
                    className="bo-horariosCalendarViewItem"
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={calendarTransition}
                    data-slot="calendar-view"
                  >
                    <MonthCalendar
                      year={year}
                      month={month}
                      days={activeCalendarDays}
                      selectedDateISO={selectedDate}
                      onSelectDate={(dateISO) => void selectDate(dateISO)}
                      onPrevMonth={() => void moveMonth(-1)}
                      onNextMonth={() => void moveMonth(1)}
                      loading={busy}
                      renderDayTooltip={calendarTab === "miembros" ? renderDayTooltip : undefined}
                      data-slot="month-calendar"
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="bo-horariosMembersPanel" data-slot="members-panel">
                <div className="bo-horariosMembersPanelHead" data-slot="members-panel-head">
                  <div className="bo-panelTitle" data-slot="members-title">Miembros</div>
                  <div className="bo-horariosMemberCount" data-slot="member-count">{filteredMembers.length}</div>
                </div>
                <div className="bo-horariosMemberSearch" data-slot="member-search">
                  <input
                    type="text"
                    className="bo-input bo-horariosMemberSearchInput"
                    placeholder="Buscar..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    aria-label="Buscar miembro"
                    data-slot="member-search-input"
                  />
                </div>
                <ScrollArea dataSlot="member-list"><div className="bo-horariosMemberList" data-slot="member-list">
                  {filteredMembers.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      className="bo-horariosMemberBtn"
                      onClick={() => openMemberModal(member)}
                      data-slot="member-btn"
                      data-member-id={member.id}
                    >
                      <span className="bo-horariosMemberName" data-slot="member-name">
                        {fullName(member)}
                        {activeEntriesForDate.has(member.id) ? (
                          <span className="bo-horariosLiveDot" aria-hidden="true" data-role="live-dot" />
                        ) : null}
                      </span>
                      <span className="bo-horariosMemberAction" data-slot="member-action">
                        <UserRoundPlus size={14} strokeWidth={1.8} data-role="user-plus-icon" />
                      </span>
                    </button>
                  ))}
                  {filteredMembers.length === 0 ? (
                    <div className="bo-mutedText" style={{ textAlign: "center", padding: 14 }} data-slot="empty-state">
                      {memberSearch.trim() ? "Sin resultados." : "Todos los miembros ya tienen horario para este dia."}
                    </div>
                  ) : null}
                </div>
              </ScrollArea>
              </div>
            </div>
        </Panel>
      </div>

      <Panel
        className="bo-horariosTablePanel min-w-0"
        data-slot="table-panel"
        title="Horarios establecidos"
        meta={selectedDate}
        bodyClassName="overflow-hidden !p-0"
      >
          <div className="bo-tabs bo-horariosCalendarTabs !w-fit mx-auto mt-3" role="tablist" aria-label="Tabla de horarios y turnos" data-slot="table-panel-tabs">
            <button
              type="button"
              className={`bo-tab bo-horariosCalendarTab${tablePanelTab === "tabla" ? " is-active" : ""}`}
              role="tab"
              aria-selected={tablePanelTab === "tabla"}
              onClick={() => selectTablePanelTab("tabla")}
              data-slot="tab-tabla"
            >
              {tablePanelTab === "tabla" ? <span className="bo-tabIndicator" data-role="tab-indicator" /> : null}
              <span className="bo-tabInner" data-slot="tab-inner">
                <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon">
                  <TableProperties size={16} strokeWidth={1.8} data-role="table-icon" />
                </span>
                <span className="bo-tabLabel" data-slot="tab-label">Tabla</span>
              </span>
            </button>
            <button
              type="button"
              className={`bo-tab bo-horariosCalendarTab${tablePanelTab === "turnos" ? " is-active" : ""}`}
              role="tab"
              aria-selected={tablePanelTab === "turnos"}
              onClick={() => selectTablePanelTab("turnos")}
              data-slot="tab-turnos"
            >
              {tablePanelTab === "turnos" ? <span className="bo-tabIndicator" data-role="tab-indicator" /> : null}
              <span className="bo-tabInner" data-slot="tab-inner">
                <span className="bo-tabIcon" aria-hidden="true" data-slot="tab-icon">
                  <Clock3 size={16} strokeWidth={1.8} data-role="clock-icon" />
                </span>
                <span className="bo-tabLabel" data-slot="tab-label">Turnos</span>
              </span>
            </button>
          </div>

          {tablePanelTab === "tabla" ? (
          <div className="bo-tableWrap min-w-0 !mt-0" data-slot="table-wrap">
            <div className="bo-tableScroll" data-slot="table-scroll">
              <table className="bo-table bo-table--horarios" aria-label="Tabla de horarios del dia" data-slot="horarios-table">
                <thead data-slot="table-head">
                  <tr data-slot="table-head-row">
                    <th data-slot="col-member">Miembro</th>
                    <th data-slot="col-start">Entrada</th>
                    <th data-slot="col-end">Salida</th>
                    <th data-slot="col-duration">Duracion</th>
                    <th data-slot="col-live">Fichaje en vivo</th>
                    <th data-slot="col-action">Accion</th>
                  </tr>
                </thead>
                <tbody data-slot="table-body">
                  {schedules.map((schedule) => {
                    const live = activeEntriesForDate.get(schedule.memberId) || null;
                    return (
                      <tr key={schedule.id} data-slot={`schedule-row-${schedule.id}`}>
                        <td data-slot="cell-member">{schedule.memberName}</td>
                        <td data-slot="cell-start">{schedule.startTime}</td>
                        <td data-slot="cell-end">{schedule.endTime}</td>
                        <td data-slot="cell-duration">{diffLabel(schedule.startTime, schedule.endTime)}</td>
                        <td data-slot="cell-live">
                          {live ? (
                            <span className="bo-horariosLivePill" data-slot="live-pill">
                              {elapsedForEntry(live, tick)}
                            </span>
                          ) : (
                            <span className="bo-mutedText" data-slot="no-live">—</span>
                          )}
                        </td>
                        <td data-slot="cell-action">
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            type="button"
                            onClick={() => {
                              const member = membersSorted.find((m) => m.id === schedule.memberId);
                              if (member) openMemberModal(member);
                            }}
                            data-role="edit-schedule-btn"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {extraActiveEntries.map((entry) => {
                    const member = membersSorted.find((m) => m.id === entry.memberId);
                    return (
                      <tr key={`live-${entry.id}`} data-slot={`extra-live-row-${entry.id}`}>
                        <td data-slot="cell-member">{entry.memberName}</td>
                        <td data-slot="cell-start">{entry.startTime}</td>
                        <td data-slot="cell-end">--:--</td>
                        <td data-slot="cell-duration">--</td>
                        <td data-slot="cell-live">
                          <span className="bo-horariosLivePill" data-slot="live-pill">{elapsedForEntry(entry, tick)}</span>
                        </td>
                        <td data-slot="cell-action">
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            type="button"
                            onClick={() => {
                              if (member) openMemberModal(member);
                            }}
                            disabled={!member}
                            data-role="edit-schedule-btn"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {schedules.length === 0 && extraActiveEntries.length === 0 ? (
                    <tr data-slot="empty-row">
                      <td colSpan={6} className="bo-mutedText" style={{ textAlign: "center", padding: 14 }} data-slot="empty-cell">
                        Sin horarios para esta fecha.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          ) : (
            <TurnosView
              date={selectedDate}
              members={data.members}
              schedules={schedules}
              error={error}
              onDateChange={(d) => {
                setSelectedDate(d);
                const [y, m] = d.split("-").map((v) => Number(v));
                if (Number.isFinite(y) && Number.isFinite(m) && (y !== year || m !== month)) {
                  setYear(y);
                  setMonth(m);
                }
              }}
              onSchedulesChange={setSchedules}
            />
          )}
        </Panel>

      <ScheduleModal
        open={modalOpen}
        selectedMember={selectedMember}
        selectedDate={selectedDate}
        entryHour={entryHour}
        entryMinute={entryMinute}
        exitHour={exitHour}
        exitMinute={exitMinute}
        busy={busy}
        onClose={() => setModalOpen(false)}
        onSave={() => void saveSchedule()}
        onSetEntryTime={setEntryTime}
        onSetExitHour={setExitHour}
        onSetExitMinute={setExitMinute}
      />
    </section>
  );
}
