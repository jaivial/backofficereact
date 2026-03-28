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

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

type HorariosCalendarTab = "miembros" | "reservas";

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
  }) as Data;
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

  const [selectedDate, setSelectedDate] = useState(data.date || todayISO());
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
    <section aria-label="Horarios" className="grid grid-gap-4 w-full max-w-full min-w-0">
      <div className="grid grid-gap-4 grid-cols-1 w-full min-w-0">
        <div className="rounded-md bg-card-2 border border-white/6 shadow-soft p-3">
          <div className="flex items-center justify-between p-4 pb-0">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <CalendarClock size={16} strokeWidth={1.8} />
                Horarios
                {realtime.pendingScheduleUpdates && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                  </span>
                )}
              </div>
              <div className="text-xs text-faint mt-1">Selecciona una fecha y asigna turnos al equipo.</div>
            </div>
            <div className="h-[30px] rounded-full border border px-3 inline-flex items-center text-xs font-medium text-muted-foreground">
              {selectedDate}
            </div>
          </div>
          <div className="p-4 grid grid-gap-3">
            <div className="grid grid-cols-2 w-full max-w-full" role="tablist" aria-label="Calendario de miembros y reservas">
              <button
                type="button"
                className={`appearance-none cursor-pointer bg-transparent text-muted-foreground text-sm ${calendarTab === "miembros" ? "text-accent" : ""}`}
                role="tab"
                aria-selected={calendarTab === "miembros"}
                onClick={() => setCalendarTab("miembros")}
              >
                {calendarTab === "miembros" ? <span className="absolute inset-0 rounded-[14px] bg-[rgba(185,168,255,0.14)] border border-[rgba(185,168,255,0.26)] shadow-[0_18px_44px_rgba(185,168,255,0.10)]" /> : null}
                <span className="flex items-center gap-2 justify-center">
                  <span aria-hidden="true">
                    <Users size={16} strokeWidth={1.8} />
                  </span>
                  <span className="text-xs">Miembros</span>
                </span>
              </button>
              <button
                type="button"
                className={`appearance-none cursor-pointer bg-transparent text-muted-foreground text-sm ${calendarTab === "reservas" ? "text-accent" : ""}`}
                role="tab"
                aria-selected={calendarTab === "reservas"}
                onClick={() => setCalendarTab("reservas")}
              >
                {calendarTab === "reservas" ? <span className="absolute inset-0 rounded-[14px] bg-[rgba(185,168,255,0.14)] border border-[rgba(185,168,255,0.26)] shadow-[0_18px_44px_rgba(185,168,255,0.10)]" /> : null}
                <span className="flex items-center gap-2 justify-center">
                  <span aria-hidden="true">
                    <CalendarDays size={16} strokeWidth={1.8} />
                  </span>
                  <span className="text-xs">Reservas</span>
                </span>
              </button>
            </div>

            <div className="grid grid-gap-3 grid-cols-1 md:grid-cols-[minmax(0,450px)_280px] items-start w-full min-w-0" style={calendarRowStyle}>
              <div className="max-w-[450px]" ref={calendarViewportRef}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={calendarTab}
                    className="min-w-0"
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

              <div className="w-[280px] flex-shrink-0 flex flex-col max-h-[480px] bg-card-2 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-semibold text-foreground">Miembros</span>
                  <span className="text-xs text-text-muted">{filteredMembers.length}</span>
                </div>
                <div className="mb-2">
                  <input
                    type="text"
                    className="w-full h-9 px-3 rounded-md border border-border bg-card text-foreground text-xs placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50"
                    placeholder="Buscar..."
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    aria-label="Buscar miembro"
                  />
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredMembers.map((member) => (
                    <button key={member.id} type="button" className="w-full flex items-center justify-between p-2 rounded-md hover:bg-card-2 transition-colors duration-150" onClick={() => openMemberModal(member)}>
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        {fullName(member)}
                        {activeEntriesForDate.has(member.id) ? (
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "var(--text-success)" }}></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: "var(--text-success)" }}></span>
                          </span>
                        ) : null}
                      </span>
                      <span className="text-text-muted">
                        <UserRoundPlus size={14} strokeWidth={1.8} />
                      </span>
                    </button>
                  ))}
                  {filteredMembers.length === 0 ? (
                    <div className="text-text-muted text-center p-3.5 text-xs">
                      {memberSearch.trim() ? "Sin resultados." : "Todos los miembros ya tienen horario para este día."}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card-2">
        <div className="flex items-center justify-between p-4 pb-0">
          <div>
            <div className="text-sm font-semibold text-foreground">Horarios establecidos</div>
            <div className="text-xs text-text-muted mt-0.5">{selectedDate}</div>
          </div>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto">
            <div className="min-w-full">
              <table className="w-full text-sm text-foreground" aria-label="Tabla de horarios del día">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium">Miembro</th>
                    <th className="text-left py-2 px-2 font-medium">Entrada</th>
                    <th className="text-left py-2 px-2 font-medium">Salida</th>
                    <th className="text-left py-2 px-2 font-medium">Duración</th>
                    <th className="text-left py-2 px-2 font-medium">Fichaje en vivo</th>
                    <th className="text-left py-2 px-2 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule) => {
                    const live = activeEntriesForDate.get(schedule.memberId) || null;
                    return (
                    <tr key={schedule.id} className="border-b border-border/50 hover:bg-card-3/50">
                      <td className="py-2 px-2">{schedule.memberName}</td>
                      <td className="py-2 px-2">{schedule.startTime}</td>
                      <td className="py-2 px-2">{schedule.endTime}</td>
                      <td className="py-2 px-2">{diffLabel(schedule.startTime, schedule.endTime)}</td>
                      <td className="py-2 px-2">
                        {live ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--text-success) 10%, transparent)", color: "var(--text-success)" }}>
                            {elapsedForEntry(live, tick)}
                          </span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          className="h-8 px-3 rounded-md text-xs font-medium text-text-muted hover:text-foreground hover:bg-card transition-colors duration-150"
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
                      <tr key={`live-${entry.id}`} className="border-b border-border/50 hover:bg-card-3/50">
                        <td className="py-2 px-2">{entry.memberName}</td>
                        <td className="py-2 px-2">{entry.startTime}</td>
                        <td className="py-2 px-2">--:--</td>
                        <td className="py-2 px-2">--</td>
                        <td className="py-2 px-2">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--text-success) 10%, transparent)", color: "var(--text-success)" }}>{elapsedForEntry(entry, tick)}</span>
                        </td>
                        <td className="py-2 px-2">
                          <button
                            className="h-8 px-3 rounded-md text-xs font-medium text-text-muted hover:text-foreground hover:bg-card transition-colors duration-150"
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
                      <td colSpan={6} className="text-text-muted text-center py-3.5 text-xs">
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
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="text-base font-semibold text-foreground">Asignar horario</div>
          <button className="text-xl text-text-muted hover:text-foreground leading-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-card-2 transition-colors" type="button" onClick={() => setModalOpen(false)} aria-label="Close">
            ×
          </button>
        </div>

        <div className="mt-2.5 p-4 rounded-lg border border-border bg-card-2">
          <div className="rounded-xl border border-border bg-card-2">
            <div className="flex items-center justify-between p-4 pb-0">
              <div>
                <div className="text-sm font-semibold text-foreground">{selectedMember ? fullName(selectedMember) : "Miembro"}</div>
                <div className="text-xs text-text-muted mt-0.5">Fecha {selectedDate}</div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground mb-2">Hora de entrada</div>
                  <div className="flex gap-2">
                    <div>
                      <div className="text-xs text-text-muted mb-1">Hora</div>
                      <SpinWheel
                        className="w-16"
                        values={hourOptions}
                        value={entryHour}
                        onChange={(nextHour) => setEntryTime(nextHour, entryMinute)}
                        ariaLabel="Hora de entrada"
                      />
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">Minutos</div>
                      <SpinWheel
                        className="w-16"
                        values={minuteOptions}
                        value={entryMinute}
                        onChange={(nextMinute) => setEntryTime(entryHour, nextMinute)}
                        ariaLabel="Minutos de entrada"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1">
                  <div className="text-xs font-medium text-foreground mb-2">Hora de salida</div>
                  <div className="flex gap-2">
                    <div>
                      <div className="text-xs text-text-muted mb-1">Hora</div>
                      <SpinWheel className="w-16" values={exitHourOptions} value={exitHour} onChange={setExitHour} ariaLabel="Hora de salida" />
                    </div>
                    <div>
                      <div className="text-xs text-text-muted mb-1">Minutos</div>
                      <SpinWheel
                        className="w-16"
                        values={exitMinuteOptions}
                        value={exitMinute}
                        onChange={setExitMinute}
                        ariaLabel="Minutos de salida"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 text-sm text-foreground">
                <Clock3 size={14} strokeWidth={1.8} />
                {`${entryHour}:${entryMinute}`} - {`${exitHour}:${exitMinute}`}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="h-9 px-4 rounded-md text-sm font-medium text-text-muted hover:text-foreground hover:bg-card-2 transition-colors duration-150" type="button" onClick={() => setModalOpen(false)}>
            Cancelar
          </button>
          <button className="h-9 px-4 rounded-md text-sm font-medium bg-accent text-background hover:opacity-90 transition-opacity duration-150" type="button" disabled={busy || !selectedMember} onClick={() => void saveSchedule()}>
            Guardar horario
          </button>
        </div>
      </Modal>
    </section>
  );
}
