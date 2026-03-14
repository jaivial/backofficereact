import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock, Play, Square, Plus, Trash2 } from "lucide-react";

import { createClient } from "../../api/client";
import type { FichajeSchedule, Member, TimeEntry } from "../../api/types";
import { Modal } from "../overlays/Modal";
import { SpinWheel } from "../inputs/SpinWheel";
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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => pad2(i));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => pad2(i));

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
}: {
  member: Member;
  selectedDate: string;
  open: boolean;
  onClose: () => void;
}) {
  const { pushToast } = useToasts();
  const [api] = useState(() => createClient({ baseUrl: "" }));

  const [schedule, setSchedule] = useState<FichajeSchedule | null>(null);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignEntryHour, setAssignEntryHour] = useState("09");
  const [assignEntryMinute, setAssignEntryMinute] = useState("00");
  const [assignExitHour, setAssignExitHour] = useState("17");
  const [assignExitMinute, setAssignExitMinute] = useState("00");

  const assignStartTime = `${assignEntryHour}:${assignEntryMinute}`;
  const assignEndTime = `${assignExitHour}:${assignExitMinute}`;

  const loadData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [horariosRes, entriesRes] = await Promise.all([
        api.horarios.list(selectedDate),
        api.fichaje.entries.list({ date: selectedDate, memberId: member.id }),
      ]);

      if (horariosRes.success) {
        const memberSchedule = horariosRes.schedules.find((s) => s.memberId === member.id) || null;
        setSchedule(memberSchedule);
      }

      if (entriesRes.success) {
        const active = entriesRes.entries.find((e) => e.endTime === null && e.workDate === selectedDate);
        setActiveEntry(active || null);
      }
    } catch (err) {
      console.error("Error loading shift data:", err);
    } finally {
      setLoading(false);
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

  const adjustTime = useCallback(
    async (field: "startTime" | "endTime", delta: number) => {
      if (!schedule) return;
      const current = schedule[field];
      const currentMin = parseTimeToMinutes(current);
      const newMin = Math.max(0, Math.min(24 * 60 - 15, currentMin + delta));
      const newTime = minutesToTime(newMin);

      setLoading(true);
      try {
        const res = await api.horarios.update(schedule.id, {
          startTime: field === "startTime" ? newTime : schedule.startTime,
          endTime: field === "endTime" ? newTime : schedule.endTime,
        });
        if (res.success) {
          setSchedule(res.schedule);
          pushToast({ kind: "success", title: "Horario actualizado" });
        } else {
          pushToast({ kind: "error", title: res.message || "Error al actualizar" });
        }
      } catch (err) {
        pushToast({ kind: "error", title: "Error al actualizar" });
      } finally {
        setLoading(false);
      }
    },
    [schedule, api, pushToast],
  );

  const startFichaje = useCallback(async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const res = await api.fichaje.adminStart(schedule.memberId);
      if (res.success) {
        const entriesRes = await api.fichaje.entries.list({ date: selectedDate, memberId: member.id });
        if (entriesRes.success) {
          const active = entriesRes.entries.find((e) => e.endTime === null && e.workDate === selectedDate);
          setActiveEntry(active || null);
        }
        pushToast({ kind: "success", title: "Fichaje iniciado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al iniciar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al iniciar" });
    } finally {
      setLoading(false);
    }
  }, [schedule, selectedDate, member.id, api, pushToast]);

  const stopFichaje = useCallback(async () => {
    if (!activeEntry) return;
    setLoading(true);
    try {
      const res = await api.fichaje.adminStop(activeEntry.memberId);
      if (res.success) {
        const entriesRes = await api.fichaje.entries.list({ date: selectedDate, memberId: member.id });
        if (entriesRes.success) {
          const active = entriesRes.entries.find((e) => e.endTime === null && e.workDate === selectedDate);
          setActiveEntry(active || null);
        }
        pushToast({ kind: "success", title: "Fichaje terminado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al terminar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al terminar" });
    } finally {
      setLoading(false);
    }
  }, [activeEntry, selectedDate, member.id, api, pushToast]);

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
    [],
  );
  const exitMinuteOptions = useMemo(() => {
    if (Number(assignExitHour) !== Number(assignEntryHour)) return MINUTE_OPTIONS;
    return MINUTE_OPTIONS.filter((m) => Number(m) >= Number(assignEntryMinute));
  }, [assignEntryHour, assignEntryMinute, assignExitHour]);

  const assignShift = useCallback(async () => {
    if (!assignStartTime || !assignEndTime) return;

    if (schedule) {
      const overlaps = hasTimeOverlap(assignStartTime, assignEndTime, schedule.startTime, schedule.endTime);
      if (overlaps) {
        pushToast({ kind: "error", title: "El nuevo turno coincide con el actual" });
        return;
      }
    }

    setLoading(true);
    try {
      const res = await api.horarios.assign({
        date: selectedDate,
        memberId: member.id,
        startTime: assignStartTime,
        endTime: assignEndTime,
      });
      if (res.success) {
        setSchedule(res.schedule);
        setShowAssignForm(false);
        pushToast({ kind: "success", title: "Turno asignado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al asignar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al asignar" });
    } finally {
      setLoading(false);
    }
  }, [assignStartTime, assignEndTime, schedule, selectedDate, member.id, api, pushToast]);

  const removeShift = useCallback(async () => {
    if (!schedule) return;
    setLoading(true);
    try {
      const res = await api.horarios.delete(schedule.id);
      if (res.success) {
        setSchedule(null);
        pushToast({ kind: "success", title: "Turno eliminado" });
      } else {
        pushToast({ kind: "error", title: res.message || "Error al eliminar" });
      }
    } catch (err) {
      pushToast({ kind: "error", title: "Error al eliminar" });
    } finally {
      setLoading(false);
    }
  }, [schedule, api, pushToast]);

  const fullName = `${member.firstName || ""} ${member.lastName || ""}`.trim() || `Miembro #${member.id}`;
  const hasSchedule = !!schedule;
  const isActive = !!activeEntry;

  return (
    <Modal open={open} onClose={onClose} title={fullName} widthPx={760}>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} strokeWidth={1.8} />
          {selectedDate}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {hasSchedule && !isActive && (
              <div className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4">
                <div className="text-sm font-semibold text-foreground mb-3">Turno actual</div>
                <div className="flex gap-4 flex-wrap">
                  <TimeAdjustCounter
                    label="Entrada"
                    value={schedule.startTime}
                    onMinus={() => adjustTime("startTime", -15)}
                    onPlus={() => adjustTime("startTime", 15)}
                    disabled={loading}
                  />
                  <TimeAdjustCounter
                    label="Salida"
                    value={schedule.endTime}
                    onMinus={() => adjustTime("endTime", -15)}
                    onPlus={() => adjustTime("endTime", 15)}
                    disabled={loading}
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 border border-white/[0.06] backdrop-blur-sm" type="button" onClick={startFichaje} disabled={loading}>
                    <Play size={14} strokeWidth={1.8} />
                    Iniciar fichaje
                  </button>
                  <button className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-transparent hover:bg-white/[0.06] text-destructive hover:bg-destructive/90 border border-white/[0.06] backdrop-blur-sm" type="button" onClick={removeShift} disabled={loading}>
                    <Trash2 size={14} strokeWidth={1.8} />
                    Quitar turno
                  </button>
                </div>
              </div>
            )}

            {hasSchedule && isActive && (
              <div className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4">
                <div className="text-sm font-semibold text-foreground mb-3">Trabajando</div>
                <div className="flex items-center justify-center py-4 bg-gradient-to-b from-white/[0.06] to-black/[0.15] rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-muted-foreground">Entrada: {activeEntry.startTime}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">En curso</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 border border-white/[0.06] backdrop-blur-sm" type="button" onClick={stopFichaje} disabled={loading}>
                    <Square size={14} strokeWidth={1.8} />
                    Fichar salida
                  </button>
                </div>
              </div>
            )}

            {!hasSchedule && (
              <div className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4">
                <div className="text-sm font-semibold text-foreground mb-3">Sin turno asignado</div>
                <button
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-white/[0.06] backdrop-blur-sm"
                  type="button"
                  onClick={() => setShowAssignForm(true)}
                  disabled={loading}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  Asignar turno
                </button>
              </div>
            )}

            <AnimatePresence>
              {((!hasSchedule && showAssignForm) || (hasSchedule && !isActive)) && (
                <motion.div
                  className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                >
                  <div className="text-sm font-semibold text-foreground mb-3">Nuevo turno</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-muted-foreground">Hora de entrada</div>
                      <div className="flex gap-2">
                        <SpinWheel
                          values={HOUR_OPTIONS}
                          value={assignEntryHour}
                          onChange={(v) => setAssignEntryTime(v, assignEntryMinute)}
                          ariaLabel="Hora de entrada"
                          className="w-full"
                        />
                        <SpinWheel
                          values={MINUTE_OPTIONS}
                          value={assignEntryMinute}
                          onChange={(v) => setAssignEntryTime(assignEntryHour, v)}
                          ariaLabel="Minutos de entrada"
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-xs text-muted-foreground">Hora de salida</div>
                      <div className="flex gap-2">
                        <SpinWheel
                          values={exitHourOptions}
                          value={assignExitHour}
                          onChange={setAssignExitHour}
                          ariaLabel="Hora de salida"
                          className="w-full"
                        />
                        <SpinWheel
                          values={exitMinuteOptions}
                          value={assignExitMinute}
                          onChange={setAssignExitMinute}
                          ariaLabel="Minutos de salida"
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-white/[0.06] backdrop-blur-sm mt-4"
                    type="button"
                    onClick={assignShift}
                    disabled={loading}
                  >
                    <Plus size={14} strokeWidth={1.8} />
                    Asignar turno
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {hasSchedule && !isActive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <button
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg w-full bg-transparent hover:bg-white/[0.06] border border-white/[0.06] backdrop-blur-sm mt-4"
                  type="button"
                  onClick={() => setShowAssignForm(!showAssignForm)}
                  disabled={loading}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  {showAssignForm ? "Cancelar" : "Añadir otro turno"}
                </button>
              </motion.div>
            )}

            {hasSchedule && isActive && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                <button
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg w-full bg-transparent hover:bg-white/[0.06] border border-white/[0.06] backdrop-blur-sm"
                  type="button"
                  onClick={() => setShowAssignForm(!showAssignForm)}
                  disabled={loading}
                >
                  <Plus size={14} strokeWidth={1.8} />
                  {showAssignForm ? "Cancelar" : "Añadir otro turno"}
                </button>

                {showAssignForm && (
                  <motion.div
                    className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4 mt-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="text-sm font-semibold text-foreground mb-3">Nuevo turno</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-muted-foreground">Hora de entrada</div>
                        <div className="flex gap-2">
                          <SpinWheel
                            values={HOUR_OPTIONS}
                            value={assignEntryHour}
                            onChange={(v) => setAssignEntryTime(v, assignEntryMinute)}
                            ariaLabel="Hora de entrada"
                            className="w-full"
                          />
                          <SpinWheel
                            values={MINUTE_OPTIONS}
                            value={assignEntryMinute}
                            onChange={(v) => setAssignEntryTime(assignEntryHour, v)}
                            ariaLabel="Minutos de entrada"
                            className="w-full"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-muted-foreground">Hora de salida</div>
                        <div className="flex gap-2">
                          <SpinWheel
                            values={exitHourOptions}
                            value={assignExitHour}
                            onChange={setAssignExitHour}
                            ariaLabel="Hora de salida"
                            className="w-full"
                          />
                          <SpinWheel
                            values={exitMinuteOptions}
                            value={assignExitMinute}
                            onChange={setAssignExitMinute}
                            ariaLabel="Minutos de salida"
                            className="w-full"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90 border border-white/[0.06] backdrop-blur-sm mt-4"
                      type="button"
                      onClick={assignShift}
                      disabled={loading}
                    >
                      <Plus size={14} strokeWidth={1.8} />
                      Asignar turno
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
