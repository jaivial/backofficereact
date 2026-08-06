import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Play, Square, Plus, Trash2 } from "lucide-react";

import { createClient } from "../../api/client";
import type { FichajeSchedule, Member, TimeEntry } from "../../api/types";
import { cn } from "../shadcn/utils";
import { Modal } from "../overlays/Modal";
import { Select } from "../inputs/Select";
import { TimeAdjustCounter } from "./TimeAdjustCounter";
import { useToasts } from "../feedback/useToasts";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => pad2(i));

function TimeSelect({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options.map((option) => ({ value: option, label: option }))}
      ariaLabel={ariaLabel}
      menuMinWidthPx={72}
      listMaxHeightPx={132}
      className="bo-shiftModalTimeSelect"
      listClassName="bo-shiftModalTimeList"
    />
  );
}

function hasTimeOverlap(
  newStart: string,
  newEnd: string,
  existingStart: string,
  existingEnd: string,
): boolean {
  const newStartMin = parseTimeToMinutes(newStart);
  const newEndMin = parseTimeToMinutes(newEnd);
  const existingStartMin = parseTimeToMinutes(existingStart);
  const existingEndMin = parseTimeToMinutes(existingEnd);
  return newStartMin < existingEndMin && newEndMin > existingStartMin;
}

export function MemberShiftModal({
  member,
  selectedDate,
  open,
  onClose,
  className,
}: {
  member: Member;
  selectedDate: string;
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  const { pushToast } = useToasts();
  const [api] = useState(() => createClient({ baseUrl: "" }));

  const [schedules, setSchedules] = useState<FichajeSchedule[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignEntryHour, setAssignEntryHour] = useState("09");
  const [assignEntryMinute, setAssignEntryMinute] = useState("00");
  const [assignExitHour, setAssignExitHour] = useState("17");
  const [assignExitMinute, setAssignExitMinute] = useState("00");
  const pendingAdjustments = useRef(new Set<string>());
  const [manualTime, setManualTime] = useState<{
    scheduleId: number;
    field: "startTime" | "endTime";
    hour: string;
    minute: string;
  } | null>(null);

  const assignStartTime = `${assignEntryHour}:${assignEntryMinute}`;
  const assignEndTime = `${assignExitHour}:${assignExitMinute}`;

  const loadData = useCallback(async () => {
    if (!open) return;
    setDataLoaded(false);
    setLoading(true);
    try {
      const [horariosRes, entriesRes] = await Promise.all([
        api.horarios.list(selectedDate),
        api.fichaje.entries.list({ date: selectedDate, memberId: member.id }),
      ]);

      if (horariosRes.success) {
        const memberSchedules = horariosRes.schedules.filter((s) => s.memberId === member.id);
        setSchedules(memberSchedules);
      }

      if (entriesRes.success) {
        const active = entriesRes.entries.find((e) => e.endTime === null && e.workDate === selectedDate);
        setActiveEntry(active || null);
      }
    } catch (err) {
      console.error("Error loading shift data:", err);
    } finally {
      setLoading(false);
      setDataLoaded(true);
    }
  }, [open, selectedDate, member.id, api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!open) {
      setShowAssignForm(false);
      setAssignEntryHour("09");
      setAssignEntryMinute("00");
      setAssignExitHour("17");
      setAssignExitMinute("00");
    }
  }, [open]);

  const refreshEntries = useCallback(async () => {
    try {
      const entriesRes = await api.fichaje.entries.list({ date: selectedDate, memberId: member.id });
      if (entriesRes.success) {
        const active = entriesRes.entries.find((e) => e.endTime === null && e.workDate === selectedDate);
        setActiveEntry(active || null);
      }
    } catch {
      // non-fatal; fichaje buttons will surface errors
    }
  }, [api.fichaje.entries, selectedDate, member.id]);

  const adjustTime = useCallback(
    async (scheduleId: number, field: "startTime" | "endTime", delta: number) => {
      const pendingKey = `${scheduleId}:${field}`;
      if (pendingAdjustments.current.has(pendingKey)) return;
      const schedule = schedules.find((s) => s.id === scheduleId);
      if (!schedule) return;
      const current = schedule[field];
      const currentMin = parseTimeToMinutes(current);
      const newMin = Math.max(0, Math.min(24 * 60 - 15, currentMin + delta));
      const newTime = minutesToTime(newMin);

      // Optimistic local update so the list reacts immediately.
      const optimisticStart = field === "startTime" ? newTime : schedule.startTime;
      const optimisticEnd = field === "endTime" ? newTime : schedule.endTime;
      const overlaps = schedules.some(
        (s) =>
          s.id !== scheduleId &&
          hasTimeOverlap(optimisticStart, optimisticEnd, s.startTime, s.endTime),
      );
      if (overlaps) {
        pushToast({ kind: "error", title: "Horario invalido", message: "El turno se solapa con otro turno ese día" });
        return;
      }

      const previousSchedules = schedules;
      pendingAdjustments.current.add(pendingKey);
      setSchedules((current) => current.map((s) => (
        s.id === scheduleId ? { ...s, startTime: optimisticStart, endTime: optimisticEnd } : s
      )));
      try {
        const res = await api.horarios.update(scheduleId, {
          startTime: optimisticStart,
          endTime: optimisticEnd,
        });
        if (res.success) {
          setSchedules((current) => current.map((s) => (s.id === scheduleId ? { ...s, ...res.schedule } : s)));
          pushToast({ kind: "success", title: "Horario actualizado" });
        } else {
          setSchedules(previousSchedules);
          pushToast({ kind: "error", title: res.message || "Error al actualizar" });
        }
      } catch (err) {
        setSchedules(previousSchedules);
        pushToast({ kind: "error", title: "Error al actualizar" });
      } finally {
        pendingAdjustments.current.delete(pendingKey);
      }
    },
    [schedules, api.horarios, pushToast],
  );

  const saveManualTime = useCallback(async (scheduleId: number, field: "startTime" | "endTime", hour: string, minute: string) => {
    const schedule = schedules.find((item) => item.id === scheduleId);
    if (!schedule) return;
    const nextTime = `${hour}:${minute}`;
    const nextStart = field === "startTime" ? nextTime : schedule.startTime;
    const nextEnd = field === "endTime" ? nextTime : schedule.endTime;
    if (parseTimeToMinutes(nextStart) >= parseTimeToMinutes(nextEnd)) return;
    const overlaps = schedules.some((item) => item.id !== scheduleId && hasTimeOverlap(nextStart, nextEnd, item.startTime, item.endTime));
    if (overlaps) {
      pushToast({ kind: "error", title: "Horario invalido", message: "El turno se solapa con otro turno ese día" });
      return;
    }
    const previous = schedules;
    const key = `${scheduleId}:${field}`;
    pendingAdjustments.current.add(key);
    setSchedules((current) => current.map((item) => item.id === scheduleId ? { ...item, startTime: nextStart, endTime: nextEnd } : item));
    setManualTime(null);
    try {
      const response = await api.horarios.update(scheduleId, { startTime: nextStart, endTime: nextEnd });
      if (!response.success) {
        setSchedules(previous);
        pushToast({ kind: "error", title: response.message || "Error al actualizar" });
      }
    } catch {
      setSchedules(previous);
      pushToast({ kind: "error", title: "Error al actualizar" });
    } finally {
      pendingAdjustments.current.delete(key);
    }
  }, [api.horarios, pushToast, schedules]);

  const manualTimeControl = useCallback((schedule: FichajeSchedule, field: "startTime" | "endTime") => {
    const current = field === "startTime" ? schedule.startTime : schedule.endTime;
    const [hour, minute] = current.split(":");
    const draft = manualTime?.scheduleId === schedule.id && manualTime.field === field ? manualTime : { scheduleId: schedule.id, field, hour, minute };
    const other = field === "startTime" ? schedule.endTime : schedule.startTime;
    const otherMinutes = parseTimeToMinutes(other);
    const hourOptions = HOUR_OPTIONS.filter((option) => field === "startTime" ? toMinutes(option, "00") < otherMinutes : toMinutes(option, "59") > otherMinutes);
    const minuteOptions = MINUTE_OPTIONS.filter((option) => {
      const candidate = toMinutes(draft.hour, option);
      return field === "startTime" ? candidate < otherMinutes : candidate > otherMinutes;
    });
    return (
      <div className="bo-timeManualControl" data-slot="time-manual-control">
        <Select value={draft.hour} onChange={(value) => setManualTime({ ...draft, hour: value })} options={hourOptions.map((value) => ({ value, label: value }))} ariaLabel={`Hora de ${field === "startTime" ? "entrada" : "salida"}`} menuMinWidthPx={64} listMaxHeightPx={132} />
        <span aria-hidden="true">:</span>
        <Select value={draft.minute} onChange={(value) => void saveManualTime(schedule.id, field, draft.hour, value)} options={minuteOptions.map((value) => ({ value, label: value }))} ariaLabel={`Minutos de ${field === "startTime" ? "entrada" : "salida"}`} menuMinWidthPx={64} listMaxHeightPx={132} />
      </div>
    );
  }, [manualTime, saveManualTime]);

  const startFichaje = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fichaje.adminStart(member.id);
      if (res.success) {
        await refreshEntries();
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al iniciar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al iniciar" });
    } finally {
      setLoading(false);
    }
  }, [member.id, api.fichaje, refreshEntries, pushToast]);

  const stopFichaje = useCallback(async () => {
    if (!activeEntry) return;
    setLoading(true);
    try {
      const res = await api.fichaje.adminStop(activeEntry.memberId);
      if (res.success) {
        await refreshEntries();
        pushToast({ kind: "success", title: "Fichaje terminado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al terminar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al terminar" });
    } finally {
      setLoading(false);
    }
  }, [activeEntry, api.fichaje, refreshEntries, pushToast]);

  const setAssignEntryTime = useCallback(
    (nextHour: string, nextMinute: string) => {
      if (nextHour !== assignEntryHour) setAssignEntryHour(nextHour);
      if (nextMinute !== assignEntryMinute) setAssignEntryMinute(nextMinute);

      const nextEntryMinutes = toMinutes(nextHour, nextMinute);
      const currentExitMinutes = toMinutes(assignExitHour, assignExitMinute);
      if (nextEntryMinutes <= currentExitMinutes) return;

      const fixed = fromMinutes(nextEntryMinutes);
      if (fixed.h !== assignExitHour) setAssignExitHour(fixed.h);
      if (fixed.m !== assignExitMinute) setAssignExitMinute(fixed.m);
    },
    [assignEntryHour, assignEntryMinute, assignExitHour, assignExitMinute],
  );

  const exitHourOptions = useMemo(
    () => HOUR_OPTIONS.filter((h) => Number(h) >= Number(assignEntryHour)),
    [assignEntryHour],
  );
  const exitMinuteOptions = useMemo(() => {
    if (Number(assignExitHour) !== Number(assignEntryHour)) return MINUTE_OPTIONS;
    return MINUTE_OPTIONS.filter((m) => Number(m) > Number(assignEntryMinute));
  }, [assignEntryHour, assignEntryMinute, assignExitHour]);

  const assignStartMinutes = toMinutes(assignEntryHour, assignEntryMinute);
  const assignEndMinutes = toMinutes(assignExitHour, assignExitMinute);
  const assignTimeInvalid = assignEndMinutes <= assignStartMinutes;

  const assignShift = useCallback(async () => {
    if (!assignStartTime || !assignEndTime || assignTimeInvalid) return;

    const overlaps = schedules.some((s) =>
      hasTimeOverlap(assignStartTime, assignEndTime, s.startTime, s.endTime),
    );
    if (overlaps) {
      pushToast({ kind: "error", title: "El nuevo turno coincide con otro turno" });
      return;
    }

    const optimisticId = -Date.now();
    const optimisticSchedule: FichajeSchedule = {
      id: optimisticId,
      memberId: member.id,
      memberName: `${member.firstName || ""} ${member.lastName || ""}`.trim() || `Miembro #${member.id}`,
      date: selectedDate,
      startTime: assignStartTime,
      endTime: assignEndTime,
      updatedAt: new Date().toISOString(),
    };
    setSchedules((current) => [...current, optimisticSchedule].sort((a, b) => a.startTime.localeCompare(b.startTime)));
    setShowAssignForm(false);
    setLoading(true);
    try {
      const res = await api.horarios.assign({
        date: selectedDate,
        memberId: member.id,
        startTime: assignStartTime,
        endTime: assignEndTime,
        });
        if (res.success) {
          setSchedules((current) => current
            .map((schedule) => schedule.id === optimisticId ? res.schedule : schedule)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)));
          pushToast({ kind: "success", title: "Turno asignado" });
        } else {
          setSchedules((current) => current.filter((schedule) => schedule.id !== optimisticId));
          pushToast({ kind: "error", title: res.message || "Error al asignar" });
        }
      } catch (err) {
        setSchedules((current) => current.filter((schedule) => schedule.id !== optimisticId));
        pushToast({ kind: "error", title: "Error al asignar" });
    } finally {
      setLoading(false);
    }
  }, [assignStartTime, assignEndTime, assignTimeInvalid, schedules, selectedDate, member.id, member.firstName, member.lastName, api.horarios, pushToast]);

  const removeShift = useCallback(
    async (scheduleId: number) => {
      const previousSchedules = schedules;
      setSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
      setLoading(true);
      try {
        const res = await api.horarios.delete(scheduleId);
        if (res.success) {
          pushToast({ kind: "success", title: "Turno eliminado" });
        } else {
          setSchedules(previousSchedules);
          pushToast({ kind: "error", title: res.message || "Error al eliminar" });
        }
      } catch (err) {
        setSchedules(previousSchedules);
        pushToast({ kind: "error", title: "Error al eliminar" });
      } finally {
        setLoading(false);
      }
    },
    [api.horarios, pushToast, schedules],
  );

  const fullName = `${member.firstName || ""} ${member.lastName || ""}`.trim() || `Miembro #${member.id}`;
  const isActive = !!activeEntry;

  return (
    <Modal open={open} onClose={onClose} title={fullName} widthPx={760} className={cn("bo-modal--memberShift", className)}>
      <div className="bo-shiftModal" data-slot="shift-modal-root">
        <div className="bo-shiftModalDate" data-slot="shift-modal-date">
          <Clock size={14} strokeWidth={1.8} />
          {selectedDate}
        </div>

        {!dataLoaded && (
          <div className="bo-shiftModalLoading" data-slot="shift-modal-loading">
            <div className="bo-spinner" data-slot="memberShiftModal-spinner" />
          </div>
        )}

        {dataLoaded && (
          <>
            {isActive ? (
              <div className="bo-shiftModalSection bo-shiftModalSection--glass" data-slot="shift-modal-active-section">
                <div className="bo-shiftModalLabel" data-slot="shift-modal-active-label">Trabajando</div>
                <div className="bo-shiftModalActive bo-shiftModalActive--glass" data-slot="shift-modal-active-badge">
                  <div className="bo-shiftModalActiveInfo" data-slot="shift-modal-active-info">
                    <span className="bo-shiftModalActiveTime" data-slot="shift-modal-active-time">Entrada: {activeEntry.startTime}</span>
                    <span className="bo-badge bo-badge--success" data-slot="shift-modal-live-badge">En curso</span>
                  </div>
                </div>
                <div className="bo-shiftModalActions" data-slot="shift-modal-actions">
                  <button className="bo-btn bo-btn--danger bo-btn--glass bo-btn--full" type="button" onClick={stopFichaje} disabled={loading} data-testid="member-shift-stop-btn">
                    <Square size={14} strokeWidth={1.8} />
                    Fichar salida
                  </button>
                </div>
              </div>
            ) : null}

            {/* Schedule list: one shift per line, mobile-friendly stacked */}
            <div className="flex flex-col gap-3" data-slot="shift-modal-schedule-list">
              {schedules.length === 0 ? (
                <div className="bo-shiftModalSection bo-shiftModalSection--glass" data-slot="shift-modal-no-schedule">
                  <div className="bo-shiftModalLabel" data-slot="shift-modal-no-schedule-label">Sin turno asignado</div>
                </div>
              ) : (
                schedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="bo-shiftModalSection bo-shiftModalSection--glass"
                    data-slot="shift-modal-current-shift"
                  >
                    <div className="bo-shiftModalLabel" data-slot="shift-modal-section-label">
                      {schedule.startTime} - {schedule.endTime}
                    </div>
                    <div className="bo-shiftModalTimes" data-slot="shift-modal-times">
                      <TimeAdjustCounter
                        label="Entrada"
                        value={schedule.startTime}
                        onMinus={() => adjustTime(schedule.id, "startTime", -15)}
                        onPlus={() => adjustTime(schedule.id, "startTime", 15)}
                        disabled={false}
                        valueControl={manualTime?.scheduleId === schedule.id && manualTime.field === "startTime" ? manualTimeControl(schedule, "startTime") : undefined}
                        onValueClick={() => setManualTime({ scheduleId: schedule.id, field: "startTime", hour: schedule.startTime.slice(0, 2), minute: schedule.startTime.slice(3, 5) })}
                      />
                      <TimeAdjustCounter
                        label="Salida"
                        value={schedule.endTime}
                        onMinus={() => adjustTime(schedule.id, "endTime", -15)}
                        onPlus={() => adjustTime(schedule.id, "endTime", 15)}
                        disabled={false}
                        valueControl={manualTime?.scheduleId === schedule.id && manualTime.field === "endTime" ? manualTimeControl(schedule, "endTime") : undefined}
                        onValueClick={() => setManualTime({ scheduleId: schedule.id, field: "endTime", hour: schedule.endTime.slice(0, 2), minute: schedule.endTime.slice(3, 5) })}
                      />
                    </div>
                    <div className="bo-shiftModalActions bo-shiftModalScheduleActions" data-slot="shift-modal-actions">
                      {!isActive ? (
                        <button className="bo-btn bo-btn--primary bo-btn--glass flex-1" type="button" onClick={startFichaje} disabled={loading} data-testid="member-shift-start-btn">
                          <Play size={14} strokeWidth={1.8} />
                          Iniciar fichaje
                        </button>
                      ) : null}
                      <button className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--glass flex-1" type="button" onClick={() => removeShift(schedule.id)} disabled={loading} data-testid={`member-shift-delete-${schedule.id}`}>
                        <Trash2 size={14} strokeWidth={1.8} />
                        Quitar turno
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add another shift */}
            <button
              className="bo-btn bo-btn--ghost bo-btn--full bo-shiftModalAddBtn bo-btn--glass"
              type="button"
              onClick={() => setShowAssignForm((v) => !v)}
              disabled={loading}
              data-testid="member-shift-toggle-add-btn"
            >
              <Plus size={14} strokeWidth={1.8} />
              {showAssignForm ? "Cancelar" : "Añadir otro turno"}
            </button>

            <AnimatePresence>
              {showAssignForm && (
                <motion.div
                  className="bo-shiftModalAssign bo-shiftModalAssign--glass"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  data-slot="shift-modal-assign-form"
                >
                  <div className="bo-shiftModalLabel" data-slot="shift-modal-assign-label">Nuevo turno</div>
                  <div className="bo-shiftModalWheels" data-slot="shift-modal-wheels">
                    <div className="bo-shiftModalWheelGroup flex-1" data-slot="shift-modal-start-wheel-group">
                      <div className="bo-shiftModalWheelLabel" data-slot="shift-modal-wheel-label">Hora de entrada</div>
                      <div className="bo-shiftModalTimePair" data-slot="shift-modal-wheel-row">
                        <TimeSelect value={assignEntryHour} options={HOUR_OPTIONS} onChange={(v) => setAssignEntryTime(v, assignEntryMinute)} ariaLabel="Hora de entrada" />
                        <span className="bo-shiftModalTimeColon" aria-hidden="true">:</span>
                        <TimeSelect value={assignEntryMinute} options={MINUTE_OPTIONS} onChange={(v) => setAssignEntryTime(assignEntryHour, v)} ariaLabel="Minutos de entrada" />
                      </div>
                    </div>
                    <div className="bo-shiftModalWheelGroup flex-1" data-slot="shift-modal-end-wheel-group">
                      <div className="bo-shiftModalWheelLabel" data-slot="shift-modal-wheel-label">Hora de salida</div>
                      <div className="bo-shiftModalTimePair" data-slot="shift-modal-wheel-row">
                        <TimeSelect value={assignExitHour} options={exitHourOptions} onChange={setAssignExitHour} ariaLabel="Hora de salida" />
                        <span className="bo-shiftModalTimeColon" aria-hidden="true">:</span>
                        <TimeSelect value={assignExitMinute} options={exitMinuteOptions} onChange={setAssignExitMinute} ariaLabel="Minutos de salida" />
                      </div>
                    </div>
                  </div>
                  {assignTimeInvalid ? (
                    <div className="bo-shiftModalValidation" role="alert" data-slot="shift-modal-validation">
                      La hora de salida debe ser posterior a la hora de entrada.
                    </div>
                  ) : null}
                  <button
                    className="bo-btn bo-btn--primary bo-btn--full bo-btn--glass"
                    type="button"
                    onClick={assignShift}
                    disabled={loading || assignTimeInvalid}
                    data-testid="member-shift-submit-btn"
                  >
                    <Plus size={14} strokeWidth={1.8} />
                    Asignar turno
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </Modal>
  );
}
