import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, CalendarDays, Clock3, UserRoundPlus, Users } from "lucide-react";

import { createClient } from "../../../api/client";
import type { CalendarDay, FichajeActiveEntry, FichajeSchedule, HorarioMonthPoint, Member } from "../../../api/types";
import { fichajeRealtimeAtom } from "../../../state/atoms";
import type { Data } from "./+data";
import { MonthCalendar } from "../../../ui/widgets/MonthCalendar";
import { Modal } from "../../../ui/overlays/Modal";
import { useToasts } from "../../../ui/feedback/useToasts";
import { SpinWheel } from "../../../ui/inputs/SpinWheel";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function splitHHMM(value: string): { h: string; m: string } {
  const raw = String(value || "").trim();
  const [h, m] = raw.split(":");
  const hh = /^\d{2}$/.test(h || "") ? h : "09";
  const mm = /^\d{2}$/.test(m || "") ? m : "00";
  return { h: hh, m: mm };
}

function toMinutes(hour: string, minute: string): number {
  const h = Number(hour);
  const m = Number(minute);
  const safeH = Number.isFinite(h) ? Math.max(0, Math.min(23, Math.floor(h))) : 0;
  const safeM = Number.isFinite(m) ? Math.max(0, Math.min(59, Math.floor(m))) : 0;
  return safeH * 60 + safeM;
}

function fromMinutes(totalMinutes: number): { h: string; m: string } {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Math.floor(totalMinutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return { h: pad2(h), m: pad2(m) };
}

function diffLabel(start: string, end: string): string {
  const [sh, sm] = start.split(":").map((v) => Number(v));
  const [eh, em] = end.split(":").map((v) => Number(v));
  if (![sh, sm, eh, em].every((v) => Number.isFinite(v))) return "--";
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function elapsedForEntry(entry: FichajeActiveEntry, nowMs: number): string {
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return "--:--:--";
  return formatElapsed((nowMs - startMs) / 1000);
}

function monthCalendarData(year: number, month: number, monthDays: HorarioMonthPoint[], membersCount: number): CalendarDay[] {
  const total = Math.max(1, membersCount);
  const byDate = new Map(monthDays.map((d) => [d.date, d.assignedCount]));
  const daysInMonth = new Date(year, month, 0).getDate();
  const out: CalendarDay[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateISO = `${year}-${pad2(month)}-${pad2(day)}`;
    const assigned = byDate.get(dateISO) ?? 0;
    out.push({
      date: dateISO,
      booking_count: assigned,
      total_people: assigned,
      limit: total,
      is_open: true,
    });
  }
  return out;
}

type HorariosCalendarTab = "miembros" | "reservas";

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const realtime = useAtomValue(fichajeRealtimeAtom);
  const setRealtime = useSetAtom(fichajeRealtimeAtom);
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState(false);

  // Dismiss pending updates when user loads schedule data
  useEffect(() => {
    if (realtime.pendingScheduleUpdates && !busy) {
      // User has viewed the data, dismiss the indicator
      setRealtime((prev) => ({ ...prev, pendingScheduleUpdates: false }));
    }
  }, [realtime.pendingScheduleUpdates, busy, setRealtime]);

  const [selectedDate, setSelectedDate] = useState(data.date);
  const [year, setYear] = useState(data.year);
  const [month, setMonth] = useState(data.month);
  const [members] = useState<Member[]>(data.members);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules);
  const [monthDays, setMonthDays] = useState<HorarioMonthPoint[]>(data.monthDays);
  const [bookingMonthDays, setBookingMonthDays] = useState<CalendarDay[]>(data.bookingMonthDays);
  const [calendarTab, setCalendarTab] = useState<HorariosCalendarTab>("miembros");
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

  const calendarDays = useMemo(() => monthCalendarData(year, month, monthDays, membersSorted.length), [year, month, monthDays, membersSorted.length]);

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
      if (!res.success) throw new Error(res.message || "No se pudo cargar horarios del día");
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

  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), []);
  const minuteOptions = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), []);
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

  const exitHourOptions = useMemo(() => hourOptions.filter((h) => Number(h) >= Number(entryHour)), [hourOptions, entryHour]);
  const exitMinuteOptions = useMemo(() => {
    if (Number(exitHour) !== Number(entryHour)) return minuteOptions;
    return minuteOptions.filter((m) => Number(m) >= Number(entryMinute));
  }, [entryHour, entryMinute, exitHour, minuteOptions]);
  const activeCalendarDays = calendarTab === "miembros" ? calendarDays : bookingMonthDays;
  const calendarTransition = reduceMotion ? { duration: 0 } : { duration: 0.6, ease: "easeInOut" as const };
  const calendarRowStyle = useMemo(
    () =>
      ({
        "--bo-horarios-mcal-height": calendarHeight ? `${calendarHeight}px` : "480px",
      }) as React.CSSProperties,
    [calendarHeight],
  );

  return (
    <section aria-label="Horarios" className="bo-content-grid bo-horariosPage">
      <div className="bo-horariosTopGrid">
        <div className="bo-panel bo-horariosCalendarPanel">
          <div className="bo-panelHead">
            <div>
              <div className="bo-panelTitle bo-horariosTitle">
                <CalendarClock size={16} strokeWidth={1.8} />
                Horarios
                {realtime.pendingScheduleUpdates && (
                  <span className="bo-pendingDot" title="Hay cambios sin ver" />
                )}
              </div>
              <div className="bo-panelMeta">Selecciona una fecha y asigna turnos al equipo.</div>
            </div>
            <div className="bo-horariosDateBadge">{selectedDate}</div>
          </div>
          <div className="bo-panelBody bo-horariosCalendarBody">
            <div className="bo-tabs bo-horariosCalendarTabs" role="tablist" aria-label="Calendario de miembros y reservas">
              <button
                type="button"
                className={`bo-tab bo-horariosCalendarTab${calendarTab === "miembros" ? " is-active" : ""}`}
                role="tab"
                aria-selected={calendarTab === "miembros"}
                onClick={() => setCalendarTab("miembros")}
              >
                {calendarTab === "miembros" ? <span className="bo-tabIndicator" /> : null}
                <span className="bo-tabInner">
                  <span className="bo-tabIcon" aria-hidden="true">
                    <Users size={16} strokeWidth={1.8} />
                  </span>
                  <span className="bo-tabLabel">Miembros</span>
                </span>
              </button>
              <button
                type="button"
                className={`bo-tab bo-horariosCalendarTab${calendarTab === "reservas" ? " is-active" : ""}`}
                role="tab"
                aria-selected={calendarTab === "reservas"}
                onClick={() => setCalendarTab("reservas")}
              >
                {calendarTab === "reservas" ? <span className="bo-tabIndicator" /> : null}
                <span className="bo-tabInner">
                  <span className="bo-tabIcon" aria-hidden="true">
                    <CalendarDays size={16} strokeWidth={1.8} />
                  </span>
                  <span className="bo-tabLabel">Reservas</span>
                </span>
              </button>
            </div>

            <div className="bo-horariosCalendarRow" style={calendarRowStyle}>
              <div className="bo-horariosCalendarViewport" ref={calendarViewportRef}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={calendarTab}
                    className="bo-horariosCalendarViewItem"
                    initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    transition={calendarTransition}
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
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="bo-horariosMembersPanel">
                <div className="bo-horariosMembersPanelHead">
                  <div className="bo-panelTitle">Miembros</div>
                  <div className="bo-horariosMemberCount">{filteredMembers.length}</div>
                </div>
                <div className="bo-horariosMemberSearch">
                  <input
                    type="text"
                    className="bo-input bo-horariosMemberSearchInput"
                    placeholder="Buscar..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    aria-label="Buscar miembro"
                  />
                </div>
                <div className="bo-horariosMemberList">
                  {filteredMembers.map((member) => (
                    <button key={member.id} type="button" className="bo-horariosMemberBtn" onClick={() => openMemberModal(member)}>
                      <span className="bo-horariosMemberName">
                        {fullName(member)}
                        {activeEntriesForDate.has(member.id) ? <span className="bo-horariosLiveDot" aria-hidden="true" /> : null}
                      </span>
                      <span className="bo-horariosMemberAction">
                        <UserRoundPlus size={14} strokeWidth={1.8} />
                      </span>
                    </button>
                  ))}
                  {filteredMembers.length === 0 ? (
                    <div className="bo-mutedText" style={{ textAlign: "center", padding: 14 }}>
                      {memberSearch.trim() ? "Sin resultados." : "Todos los miembros ya tienen horario para este día."}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bo-panel bo-horariosTablePanel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle">Horarios establecidos</div>
            <div className="bo-panelMeta">{selectedDate}</div>
          </div>
        </div>
        <div className="bo-panelBody">
          <div className="bo-tableWrap">
            <div className="bo-tableScroll">
              <table className="bo-table bo-table--horarios" aria-label="Tabla de horarios del día">
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Entrada</th>
                    <th>Salida</th>
                    <th>Duración</th>
                    <th>Fichaje en vivo</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => {
                    const live = activeEntriesForDate.get(schedule.memberId) || null;
                    return (
                    <tr key={schedule.id}>
                      <td>{schedule.memberName}</td>
                      <td>{schedule.startTime}</td>
                      <td>{schedule.endTime}</td>
                      <td>{diffLabel(schedule.startTime, schedule.endTime)}</td>
                      <td>
                        {live ? (
                          <span className="bo-horariosLivePill">
                            {elapsedForEntry(live, tick)}
                          </span>
                        ) : (
                          <span className="bo-mutedText">—</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="bo-btn bo-btn--ghost bo-btn--sm"
                          type="button"
                          onClick={() => {
                            const member = membersSorted.find((m) => m.id === schedule.memberId);
                            if (member) openMemberModal(member);
                          }}
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
                      <tr key={`live-${entry.id}`}>
                        <td>{entry.memberName}</td>
                        <td>{entry.startTime}</td>
                        <td>--:--</td>
                        <td>--</td>
                        <td>
                          <span className="bo-horariosLivePill">{elapsedForEntry(entry, tick)}</span>
                        </td>
                        <td>
                          <button
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            type="button"
                            onClick={() => {
                              if (member) openMemberModal(member);
                            }}
                            disabled={!member}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {schedules.length === 0 && extraActiveEntries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="bo-mutedText" style={{ textAlign: "center", padding: 14 }}>
                        Sin horarios para esta fecha.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} title="Asignar horario" onClose={() => setModalOpen(false)} widthPx={760}>
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Asignar horario</div>
          <button className="bo-modalX" type="button" onClick={() => setModalOpen(false)} aria-label="Close">
            ×
          </button>
        </div>

        <div className="bo-modalOutline" style={{ marginTop: 10 }}>
          <div className="bo-panel bo-horariosModalPanel">
            <div className="bo-panelHead">
              <div>
                <div className="bo-panelTitle">{selectedMember ? fullName(selectedMember) : "Miembro"}</div>
                <div className="bo-panelMeta">Fecha {selectedDate}</div>
              </div>
            </div>

            <div className="bo-panelBody bo-horariosModalBody">
              <div className="bo-horariosWheels">
                <div className="bo-horariosWheelGroup">
                  <div className="bo-label">Hora de entrada</div>
                  <div className="bo-horariosWheelRow">
                    <div>
                      <div className="bo-horariosWheelLabel">Hora</div>
                      <SpinWheel
                        className="bo-horariosWheelSpin"
                        values={hourOptions}
                        value={entryHour}
                        onChange={(nextHour) => setEntryTime(nextHour, entryMinute)}
                        ariaLabel="Hora de entrada"
                      />
                    </div>
                    <div>
                      <div className="bo-horariosWheelLabel">Minutos</div>
                      <SpinWheel
                        className="bo-horariosWheelSpin"
                        values={minuteOptions}
                        value={entryMinute}
                        onChange={(nextMinute) => setEntryTime(entryHour, nextMinute)}
                        ariaLabel="Minutos de entrada"
                      />
                    </div>
                  </div>
                </div>

                <div className="bo-horariosWheelGroup">
                  <div className="bo-label">Hora de salida</div>
                  <div className="bo-horariosWheelRow">
                    <div>
                      <div className="bo-horariosWheelLabel">Hora</div>
                      <SpinWheel className="bo-horariosWheelSpin" values={exitHourOptions} value={exitHour} onChange={setExitHour} ariaLabel="Hora de salida" />
                    </div>
                    <div>
                      <div className="bo-horariosWheelLabel">Minutos</div>
                      <SpinWheel
                        className="bo-horariosWheelSpin"
                        values={exitMinuteOptions}
                        value={exitMinute}
                        onChange={setExitMinute}
                        ariaLabel="Minutos de salida"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bo-horariosPreview">
                <Clock3 size={14} strokeWidth={1.8} />
                {`${entryHour}:${entryMinute}`} - {`${exitHour}:${exitMinute}`}
              </div>
            </div>
          </div>
        </div>

        <div className="bo-modalActions">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setModalOpen(false)}>
            Cancelar
          </button>
          <button className="bo-btn bo-btn--primary" type="button" disabled={busy || !selectedMember} onClick={() => void saveSchedule()}>
            Guardar horario
          </button>
        </div>
      </Modal>
    </section>
  );
}
