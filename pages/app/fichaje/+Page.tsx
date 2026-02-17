import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { usePageContext } from "vike-react/usePageContext";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Clock3, Play, Square, Wifi, WifiOff } from "lucide-react";

import { createClient } from "../../../api/client";
import type { FichajeActiveEntry, FichajeSchedule, Member } from "../../../api/types";
import { fichajeRealtimeAtom } from "../../../state/atoms";
import { useToasts } from "../../../ui/feedback/useToasts";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { DatePicker } from "../../../ui/inputs/DatePicker";
import { MemberPicker, type MemberPickerItem } from "../../../ui/widgets/MemberPicker";
import { TimeAdjust } from "../../../ui/widgets/TimeAdjust";

function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function elapsedForEntry(entry: FichajeActiveEntry, nowMs: number): string {
  const startMs = Date.parse(entry.startAtIso);
  if (!Number.isFinite(startMs)) return "00:00:00";
  return formatElapsed((nowMs - startMs) / 1000);
}

function toActiveEntriesByMember(entries: FichajeActiveEntry[] | null | undefined): Record<number, FichajeActiveEntry> {
  const out: Record<number, FichajeActiveEntry> = {};
  for (const entry of entries || []) {
    if (!entry || !Number.isFinite(entry.memberId) || entry.memberId <= 0) continue;
    out[entry.memberId] = entry;
  }
  return out;
}

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

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

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();
  const [realtime, setRealtime] = useAtom(fichajeRealtimeAtom);
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const [dni, setDni] = useState(data.state?.member?.dni ?? "");
  const [password, setPassword] = useState("");
  const [busyStart, setBusyStart] = useState(false);
  const [busyStop, setBusyStop] = useState(false);

  const [date, setDate] = useState(data.date);
  const [members] = useState<Member[]>(data.members || []);
  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules || []);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(() => {
    const raw = Number(pageContext.urlParsed?.search?.memberId ?? 0);
    if (Number.isFinite(raw) && raw > 0) return raw;
    return data.members[0]?.id ?? null;
  });
  const [busyAdminAction, setBusyAdminAction] = useState(false);
  const [busyScheduleUpdate, setBusyScheduleUpdate] = useState(false);

  useEffect(() => {
    if (!data.state) return;
    const byMember = toActiveEntriesByMember(data.state.activeEntries || []);
    if (data.state.activeEntry?.memberId) {
      byMember[data.state.activeEntry.memberId] = data.state.activeEntry;
    }
    setRealtime((prev) => ({
      ...prev,
      member: data.state?.member ?? null,
      activeEntriesByMember: byMember,
      activeEntry: data.state?.activeEntry ?? null,
      scheduleToday: data.state?.scheduleToday ?? null,
      lastSyncAt: Date.now(),
    }));
  }, [data.state?.now, data.state?.member?.id, data.state?.activeEntry?.id, data.state?.scheduleToday?.id, setRealtime]);

  useEffect(() => {
    const memberDni = data.state?.member?.dni ?? "";
    if (!memberDni) return;
    setDni((prev) => prev || memberDni);
  }, [data.state?.member?.dni]);

  const activeEntriesForDate = useMemo(() => {
    const out = new Map<number, FichajeActiveEntry>();
    for (const entry of Object.values(realtime.activeEntriesByMember)) {
      if (!entry || entry.workDate !== date) continue;
      out.set(entry.memberId, entry);
    }
    return out;
  }, [date, realtime.activeEntriesByMember]);

  useEffect(() => {
    if (!realtime.activeEntry && activeEntriesForDate.size === 0) return;
    const timer = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeEntriesForDate.size, realtime.activeEntry?.id, realtime.activeEntry?.startAtIso]);

  const syncRealtimeState = useCallback(async () => {
    const res = await api.fichaje.getState();
    if (!res.success) return;
    const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
    if (res.state.activeEntry?.memberId) {
      byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
    }
    setRealtime((prev) => ({
      ...prev,
      member: res.state.member,
      activeEntriesByMember: byMember,
      activeEntry: res.state.activeEntry,
      scheduleToday: res.state.scheduleToday,
      lastSyncAt: Date.now(),
    }));
  }, [api.fichaje, setRealtime]);

  const onStart = useCallback(
    async (ev: React.FormEvent) => {
      ev.preventDefault();
      setError(null);
      if (!dni.trim() || !password.trim()) {
        setError("Introduce DNI y contraseña para fichar");
        return;
      }
      setBusyStart(true);
      try {
        const res = await api.fichaje.start({ dni: dni.trim(), password });
        if (!res.success) {
          setError(res.message || "No se pudo iniciar el fichaje");
          return;
        }
        const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
        if (res.state.activeEntry?.memberId) {
          byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
        }
        setRealtime((prev) => ({
          ...prev,
          member: res.state.member,
          activeEntriesByMember: byMember,
          activeEntry: res.state.activeEntry,
          scheduleToday: res.state.scheduleToday,
          lastSyncAt: Date.now(),
        }));
        setPassword("");
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo iniciar el fichaje");
      } finally {
        setBusyStart(false);
      }
    },
    [api.fichaje, dni, password, pushToast, setRealtime],
  );

  const onStop = useCallback(async () => {
    setError(null);
    setBusyStop(true);
    try {
      const res = await api.fichaje.stop();
      if (!res.success) {
        setError(res.message || "No se pudo cerrar el fichaje");
        return;
      }
      const byMember = toActiveEntriesByMember(res.state.activeEntries || []);
      if (res.state.activeEntry?.memberId) {
        byMember[res.state.activeEntry.memberId] = res.state.activeEntry;
      }
      setRealtime((prev) => ({
        ...prev,
        member: res.state.member,
        activeEntriesByMember: byMember,
        activeEntry: res.state.activeEntry,
        scheduleToday: res.state.scheduleToday,
        lastSyncAt: Date.now(),
      }));
      pushToast({ kind: "success", title: "Fichaje finalizado" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar el fichaje");
    } finally {
      setBusyStop(false);
    }
  }, [api.fichaje, pushToast, setRealtime]);

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

  const onDateChange = useCallback(
    async (nextDate: string) => {
      setDate(nextDate);
      syncURL(nextDate, selectedMemberId);
      setError(null);
      try {
        await loadSchedules(nextDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron cargar horarios");
      }
    },
    [loadSchedules, selectedMemberId, syncURL],
  );

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );

  const selectedEntry = useMemo(() => {
    if (!selectedMemberId) return null;
    return activeEntriesForDate.get(selectedMemberId) || null;
  }, [activeEntriesForDate, selectedMemberId]);

  const scheduleByMember = useMemo(() => {
    const out = new Map<number, FichajeSchedule>();
    for (const schedule of schedules) out.set(schedule.memberId, schedule);
    return out;
  }, [schedules]);

  const selectedSchedule = useMemo(() => {
    if (!selectedMemberId) return undefined;
    return scheduleByMember.get(selectedMemberId);
  }, [scheduleByMember, selectedMemberId]);

  const pickerItems = useMemo<MemberPickerItem[]>(() => {
    const sorted = [...members].sort((a, b) => fullName(a).localeCompare(fullName(b), "es", { sensitivity: "base" }));
    const query = memberSearch.trim().toLowerCase();
    const filtered = query ? sorted.filter((member) => fullName(member).toLowerCase().includes(query)) : sorted;
    return filtered.map((member) => ({
      id: member.id,
      name: fullName(member),
      meta: scheduleByMember.has(member.id) ? "Asignado" : "Sin horario",
      live: activeEntriesForDate.has(member.id),
    }));
  }, [activeEntriesForDate, memberSearch, members, scheduleByMember]);

  const onSelectMember = useCallback(
    (memberId: number) => {
      setSelectedMemberId(memberId);
      syncURL(date, memberId);
    },
    [date, syncURL],
  );

  const onAdminStart = useCallback(async () => {
    if (!selectedMemberId) return;
    setError(null);
    setBusyAdminAction(true);
    try {
      const res = await api.fichaje.adminStart(selectedMemberId);
      if (!res.success) {
        setError(res.message || "No se pudo iniciar fichaje del miembro");
        return;
      }
      await syncRealtimeState();
      pushToast({ kind: "success", title: "Fichaje iniciado" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar fichaje del miembro");
    } finally {
      setBusyAdminAction(false);
    }
  }, [api.fichaje, pushToast, selectedMemberId, syncRealtimeState]);

  const onAdminStop = useCallback(async () => {
    if (!selectedMemberId) return;
    setError(null);
    setBusyAdminAction(true);
    try {
      const res = await api.fichaje.adminStop(selectedMemberId);
      if (!res.success) {
        setError(res.message || "No se pudo cerrar fichaje del miembro");
        return;
      }
      await syncRealtimeState();
      pushToast({ kind: "success", title: "Fichaje finalizado" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cerrar fichaje del miembro");
    } finally {
      setBusyAdminAction(false);
    }
  }, [api.fichaje, pushToast, selectedMemberId, syncRealtimeState]);

  const adjustSchedule = useCallback(
    async (field: "start" | "end", deltaMinutes: number) => {
      if (!selectedMemberId || !selectedSchedule) return;
      const nextStart = field === "start" ? shiftHHMM(selectedSchedule.startTime, deltaMinutes) : selectedSchedule.startTime;
      const nextEnd = field === "end" ? shiftHHMM(selectedSchedule.endTime, deltaMinutes) : selectedSchedule.endTime;
      if (!nextStart || !nextEnd) return;

      const startM = parseHHMM(nextStart);
      const endM = parseHHMM(nextEnd);
      if (startM === null || endM === null || endM <= startM) {
        pushToast({ kind: "error", title: "Horario invalido", message: "La salida debe ser mayor que la entrada" });
        return;
      }

      setBusyScheduleUpdate(true);
      setError(null);
      try {
        const res = await api.horarios.assign({ date, memberId: selectedMemberId, startTime: nextStart, endTime: nextEnd });
        if (!res.success) {
          setError(res.message || "No se pudo actualizar horario");
          return;
        }
        setSchedules((prev) => {
          const filtered = prev.filter((item) => item.memberId !== selectedMemberId || item.date !== date);
          return [...filtered, res.schedule];
        });
        pushToast({ kind: "success", title: "Horario actualizado" });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo actualizar horario");
      } finally {
        setBusyScheduleUpdate(false);
      }
    },
    [api.horarios, date, pushToast, selectedMemberId, selectedSchedule],
  );

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" as const };

  if (!data.isAdminView) {
    return (
      <section aria-label="Fichaje" className="bo-content-grid bo-fichajePage">
        <div className="bo-panel bo-fichajePanel">
          <div className="bo-panelHead">
            <div>
              <div className="bo-panelTitle bo-fichajeTitle">
                <Clock3 size={16} strokeWidth={1.8} />
                Fichaje
              </div>
              <div className="bo-panelMeta">
                {realtime.wsConnected
                  ? "Conectado en tiempo real"
                  : realtime.wsConnecting
                    ? "Conectando tiempo real..."
                    : "Sincronización por API"}
              </div>
            </div>
            <div className={`bo-fichajeConn${realtime.wsConnected ? " is-live" : ""}`}>
              {realtime.wsConnected ? <Wifi size={15} strokeWidth={1.8} /> : <WifiOff size={15} strokeWidth={1.8} />}
              {realtime.wsConnected ? "WS" : "OFF"}
            </div>
          </div>

          <div className="bo-panelBody bo-fichajeBody">
            <AnimatePresence mode="wait" initial={false}>
              {realtime.activeEntry ? (
                <motion.div
                  key="active"
                  className="bo-fichajeRunning"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={transition}
                >
                  <div className="bo-fichajeStartSmall">Fichaje inicial · {realtime.activeEntry.startTime}</div>
                  <div className="bo-fichajeCounter" aria-live="polite">
                    {elapsedForEntry(realtime.activeEntry, tick)}
                  </div>
                  <div className="bo-fichajeMemberName">{realtime.activeEntry.memberName}</div>
                  <div className="bo-fichajeScheduleNote">
                    {realtime.scheduleToday
                      ? `Horario previsto: ${realtime.scheduleToday.startTime} - ${realtime.scheduleToday.endTime}`
                      : "Sin horario previsto para hoy"}
                  </div>
                  <button className="bo-btn bo-btn--ghost bo-fichajeStopBtn" type="button" disabled={busyStop} onClick={onStop}>
                    <Square size={16} strokeWidth={1.8} />
                    {busyStop ? "Cerrando..." : "Finalizar fichaje"}
                  </button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  className="bo-fichajeForm"
                  initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={transition}
                  onSubmit={onStart}
                >
                  <div className="bo-fichajeFormRow">
                    <label className="bo-label" htmlFor="bo-fichaje-dni">
                      DNI
                    </label>
                    <input
                      id="bo-fichaje-dni"
                      className="bo-input"
                      value={dni}
                      onChange={(ev) => setDni(ev.target.value)}
                      placeholder="00000000X"
                      autoComplete="off"
                    />
                  </div>

                  <div className="bo-fichajeFormRow">
                    <label className="bo-label" htmlFor="bo-fichaje-password">
                      Contraseña
                    </label>
                    <input
                      id="bo-fichaje-password"
                      type="password"
                      className="bo-input"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>

                  <button className="bo-btn bo-btn--primary bo-fichajeStartBtn" type="submit" disabled={busyStart}>
                    <Play size={16} strokeWidth={1.8} />
                    {busyStart ? "Validando..." : "Fichar"}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Fichaje administrado" className="bo-fichajePage bo-fichajeAdminPage">
      <div className="bo-panel bo-fichajeAdminPanel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle bo-fichajeTitle">
              <Clock3 size={16} strokeWidth={1.8} />
              Fichaje Admin
            </div>
            <div className="bo-panelMeta">Inicia, finaliza y supervisa fichajes del equipo en tiempo real.</div>
          </div>
          <div className="bo-horariosPreviewActions">
            <DatePicker value={date} onChange={(nextDate) => void onDateChange(nextDate)} />
            <div className="bo-horariosDateBadge">{date}</div>
            <div className={`bo-fichajeConn${realtime.wsConnected ? " is-live" : ""}`}>
              {realtime.wsConnected ? <Wifi size={15} strokeWidth={1.8} /> : <WifiOff size={15} strokeWidth={1.8} />}
              {realtime.wsConnected ? "WS" : "OFF"}
            </div>
          </div>
        </div>

        <div className="bo-panelBody bo-fichajeAdminBody">
          <MemberPicker
            title="Miembros"
            searchValue={memberSearch}
            onSearchChange={setMemberSearch}
            items={pickerItems}
            selectedId={selectedMemberId}
            onSelect={onSelectMember}
            emptyLabel="No hay miembros para mostrar."
          />

          <section className="bo-fichajeAdminWork" aria-label="Panel de control de fichaje">
            <div className="bo-fichajeAdminMember">
              <div className="bo-panelTitle">{selectedMember ? fullName(selectedMember) : "Selecciona un miembro"}</div>
              <div className="bo-panelMeta">
                {selectedSchedule
                  ? `Horario previsto: ${selectedSchedule.startTime} - ${selectedSchedule.endTime}`
                  : "Sin horario previsto para esta fecha"}
              </div>
            </div>

            {selectedEntry ? (
              <div className="bo-fichajeRunning">
                <div className="bo-fichajeStartSmall">Fichaje inicial · {selectedEntry.startTime}</div>
                <div className="bo-fichajeCounter" aria-live="polite">
                  {elapsedForEntry(selectedEntry, tick)}
                </div>
                <div className="bo-fichajeMemberName">{selectedEntry.memberName}</div>
                <button className="bo-btn bo-btn--ghost bo-fichajeStopBtn" type="button" disabled={busyAdminAction} onClick={() => void onAdminStop()}>
                  <Square size={16} strokeWidth={1.8} />
                  {busyAdminAction ? "Cerrando..." : "Finalizar fichaje"}
                </button>
              </div>
            ) : (
              <div className="bo-fichajeAdminIdle">
                <button className="bo-btn bo-btn--primary bo-fichajeStartBtn" type="button" disabled={!selectedMemberId || busyAdminAction} onClick={() => void onAdminStart()}>
                  <Play size={16} strokeWidth={1.8} />
                  {busyAdminAction ? "Iniciando..." : "Iniciar fichaje"}
                </button>
              </div>
            )}

            <div className="bo-fichajeAdminSchedule">
              <div className="bo-panelTitle bo-fichajeAdminScheduleTitle">
                <CalendarClock size={15} strokeWidth={1.8} />
                Turno asignado
              </div>
              {selectedSchedule ? (
                <div className="bo-fichajeAdminScheduleGrid">
                  <TimeAdjust
                    label="Entrada"
                    value={selectedSchedule.startTime}
                    onMinus={() => void adjustSchedule("start", -15)}
                    onPlus={() => void adjustSchedule("start", 15)}
                    disabled={busyScheduleUpdate}
                  />
                  <TimeAdjust
                    label="Salida"
                    value={selectedSchedule.endTime}
                    onMinus={() => void adjustSchedule("end", -15)}
                    onPlus={() => void adjustSchedule("end", 15)}
                    disabled={busyScheduleUpdate}
                  />
                </div>
              ) : (
                <div className="bo-mutedText">Asigna el horario desde la sección Horarios para habilitar ajustes rápidos.</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
