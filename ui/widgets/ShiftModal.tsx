import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Clock3, Play, Square, Plus, Minus, Trash2, Check } from "lucide-react";

import { createClient } from "../../api/client";
import type { FichajeSchedule, Member, FichajeActiveEntry } from "../../api/types";
import { Modal } from "../overlays/Modal";
import { SpinWheel } from "../inputs/SpinWheel";

const HOUR_VALUES = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_VALUES = ["00", "15", "30", "45"];

function parseTime(time: string): { hours: string; minutes: string } {
  const [h, m] = time.split(":");
  return { hours: h || "00", minutes: m || "00" };
}

function formatTime(hours: string, minutes: string): string {
  return `${hours}:${minutes}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function checkOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string,
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);
  return s1 < e2 && s2 < e1;
}

type ShiftModalProps = {
  open: boolean;
  member: Member | null;
  date: string;
  schedule: FichajeSchedule | undefined;
  activeEntry: FichajeActiveEntry | undefined;
  onClose: () => void;
  onSuccess: () => void;
};

export function ShiftModal({
  open,
  member,
  date,
  schedule,
  activeEntry,
  onClose,
  onSuccess,
}: ShiftModalProps) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const currentSchedule = schedule;
  const hasSchedule = !!currentSchedule;
  const isActive = !!activeEntry;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignedSuccessfully, setAssignedSuccessfully] = useState(false);

  const [startTime, setStartTime] = useState(() =>
    currentSchedule ? currentSchedule.startTime : "09:00",
  );
  const [endTime, setEndTime] = useState(() =>
    currentSchedule ? currentSchedule.endTime : "17:00",
  );

  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("17:00");

  useEffect(() => {
    if (!open) {
      setShowAssignForm(false);
      setAssignedSuccessfully(false);
      setError(null);
      return;
    }
    setStartTime(currentSchedule?.startTime || "09:00");
    setEndTime(currentSchedule?.endTime || "17:00");
    setNewStartTime("09:00");
    setNewEndTime("17:00");
  }, [open, currentSchedule]);

  const adjustTime = useCallback(
    (current: string, delta: number): string => {
      const mins = timeToMinutes(current) + delta;
      const clamped = Math.max(0, Math.min(24 * 60 - 1, mins));
      const h = Math.floor(clamped / 60);
      const m = clamped % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    },
    [],
  );

  const handleStartTimeAdjust = useCallback(
    (delta: number) => {
      const next = adjustTime(startTime, delta);
      setStartTime(next);
    },
    [adjustTime, startTime],
  );

  const handleEndTimeAdjust = useCallback(
    (delta: number) => {
      const next = adjustTime(endTime, delta);
      setEndTime(next);
    },
    [adjustTime, endTime],
  );

  const handleNewStartTimeAdjust = useCallback(
    (delta: number) => {
      const next = adjustTime(newStartTime, delta);
      setNewStartTime(next);
    },
    [adjustTime, newStartTime],
  );

  const handleNewEndTimeAdjust = useCallback(
    (delta: number) => {
      const next = adjustTime(newEndTime, delta);
      setNewEndTime(next);
    },
    [adjustTime, newEndTime],
  );

  const handleUpdateSchedule = useCallback(async () => {
    if (!currentSchedule) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.horarios.update(currentSchedule.id, {
        startTime,
        endTime,
      });
      if (!res.success) {
        setError(res.message || "Error actualizando horario");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error actualizando horario");
    } finally {
      setBusy(false);
    }
  }, [api.horarios, currentSchedule, startTime, endTime, onSuccess]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!currentSchedule) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.horarios.delete(currentSchedule.id);
      if (!res.success) {
        setError(res.message || "Error eliminando horario");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error eliminando horario");
    } finally {
      setBusy(false);
    }
  }, [api.horarios, currentSchedule, onSuccess]);

  const handleAssignShift = useCallback(async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.horarios.assign({
        date,
        memberId: member.id,
        startTime: newStartTime,
        endTime: newEndTime,
      });
      if (!res.success) {
        setError(res.message || "Error asignando horario");
        return;
      }
      setAssignedSuccessfully(true);
      setShowAssignForm(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error asignando horario");
    } finally {
      setBusy(false);
    }
  }, [api.horarios, member, date, newStartTime, newEndTime, onSuccess]);

  const handleClockIn = useCallback(async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.fichaje.adminStart(member.id);
      if (!res.success) {
        setError(res.message || "Error iniciando fichaje");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error iniciando fichaje");
    } finally {
      setBusy(false);
    }
  }, [api.fichaje, member, onSuccess]);

  const handleClockOut = useCallback(async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.fichaje.adminStop(member.id);
      if (!res.success) {
        setError(res.message || "Error deteniendo fichaje");
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deteniendo fichaje");
    } finally {
      setBusy(false);
    }
  }, [api.fichaje, member, onSuccess]);

  const handleAddNewShift = useCallback(async () => {
    if (!member) return;
    if (
      currentSchedule &&
      checkOverlap(newStartTime, newEndTime, currentSchedule.startTime, currentSchedule.endTime)
    ) {
      setError("El nuevo turno no puede coincidir con el turno actual");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.horarios.assign({
        date,
        memberId: member.id,
        startTime: newStartTime,
        endTime: newEndTime,
      });
      if (!res.success) {
        setError(res.message || "Error asignando turno");
        return;
      }
      setNewStartTime("09:00");
      setNewEndTime("17:00");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error asignando turno");
    } finally {
      setBusy(false);
    }
  }, [api.horarios, member, date, currentSchedule, newStartTime, newEndTime, onSuccess]);

  const fullName = useCallback(
    (m: Member) => {
      const name = `${m.firstName || ""} ${m.lastName || ""}`.trim();
      return name || `Miembro #${m.id}`;
    },
    [],
  );

  const startParsed = useMemo(() => parseTime(startTime), [startTime]);
  const endParsed = useMemo(() => parseTime(endTime), [endTime]);
  const newStartParsed = useMemo(() => parseTime(newStartTime), [newStartTime]);
  const newEndParsed = useMemo(() => parseTime(newEndTime), [newEndTime]);

  const overlapWarning =
    currentSchedule &&
    checkOverlap(newStartTime, newEndTime, currentSchedule.startTime, currentSchedule.endTime);

  if (!member) return null;

  return (
    <Modal open={open} title={fullName(member)} onClose={onClose} widthPx={420}>
      <div className="p-4 space-y-4">
        {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

        {hasSchedule && !isActive && (
          <>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-foreground mb-3">Turno actual</div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] transition-colors"
                    aria-label="Restar 15 minutos a hora de entrada"
                    onClick={() => handleStartTimeAdjust(-15)}
                  >
                    <Minus size={14} strokeWidth={1.8} />
                  </button>
                  <div className="text-lg font-semibold tabular-nums min-w-[60px] text-center">{startTime}</div>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] transition-colors"
                    aria-label="Sumar 15 minutos a hora de entrada"
                    onClick={() => handleStartTimeAdjust(15)}
                  >
                    <Plus size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <span className="text-muted-foreground">-</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] transition-colors"
                    aria-label="Restar 15 minutos a hora de salida"
                    onClick={() => handleEndTimeAdjust(-15)}
                  >
                    <Minus size={14} strokeWidth={1.8} />
                  </button>
                  <div className="text-lg font-semibold tabular-nums min-w-[60px] text-center">{endTime}</div>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] transition-colors"
                    aria-label="Sumar 15 minutos a hora de salida"
                    onClick={() => handleEndTimeAdjust(15)}
                  >
                    <Plus size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  onClick={handleUpdateSchedule}
                  disabled={busy}
                >
                  <Clock3 size={14} strokeWidth={1.8} />
                  Actualizar
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleDeleteSchedule}
                  disabled={busy}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  Quitar turno
                </button>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleClockIn}
              disabled={busy}
            >
              <Play size={16} strokeWidth={1.8} />
              Fichar entrada
            </button>
          </>
        )}

        {!hasSchedule && !assignedSuccessfully && (
          <>
            {!showAssignForm ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setShowAssignForm(true)}
              >
                <Plus size={16} strokeWidth={1.8} />
                Asignar turno
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  className="space-y-4 pt-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-sm font-semibold text-foreground mb-3">Nuevo turno</div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="flex items-center gap-1">
                      <SpinWheel
                        values={HOUR_VALUES}
                        value={newStartParsed.hours}
                        onChange={(h: string) => setNewStartTime(formatTime(h, newStartParsed.minutes))}
                        ariaLabel="Hora de entrada"
                        className="w-16"
                      />
                      <span className="text-lg font-semibold">:</span>
                      <SpinWheel
                        values={MINUTE_VALUES}
                        value={newStartParsed.minutes}
                        onChange={(m: string) => setNewStartTime(formatTime(newStartParsed.hours, m))}
                        ariaLabel="Minutos de entrada"
                        className="w-16"
                      />
                    </div>
                    <span className="text-muted-foreground">-</span>
                    <div className="flex items-center gap-1">
                      <SpinWheel
                        values={HOUR_VALUES}
                        value={newEndParsed.hours}
                        onChange={(h: string) => setNewEndTime(formatTime(h, newEndParsed.minutes))}
                        ariaLabel="Hora de salida"
                        className="w-16"
                      />
                      <span className="text-lg font-semibold">:</span>
                      <SpinWheel
                        values={MINUTE_VALUES}
                        value={newEndParsed.minutes}
                        onChange={(m: string) => setNewEndTime(formatTime(newEndParsed.hours, m))}
                        ariaLabel="Minutos de salida"
                        className="w-16"
                      />
                    </div>
                  </div>
                  {overlapWarning && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
                      El nuevo turno no puede coincidir con el turno actual
                    </div>
                  )}
                  <button
                    type="button"
                    className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleAssignShift}
                    disabled={busy || !!overlapWarning}
                  >
                    <Check size={16} strokeWidth={1.8} />
                    Asignar turno
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </>
        )}

        {assignedSuccessfully && !isActive && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.2 }}
            >
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleClockIn}
                disabled={busy}
              >
                <Play size={16} strokeWidth={1.8} />
                Fichar entrada
              </button>
            </motion.div>
          </AnimatePresence>
        )}

        {isActive && (
          <>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-foreground mb-3">Fichaje activo</div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">En vivo</span>
                <span className="text-sm text-muted-foreground">
                  Entrada: {activeEntry?.startTime || "--:--"}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleClockOut}
              disabled={busy}
            >
              <Square size={16} strokeWidth={1.8} />
              Fichar salida
            </button>
          </>
        )}

        {hasSchedule && isActive && (
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="text-sm font-semibold text-foreground mb-3">Añadir otro turno</div>
            <div className="flex items-center gap-2 justify-center">
              <div className="flex items-center gap-1">
                <SpinWheel
                  values={HOUR_VALUES}
                  value={newStartParsed.hours}
                  onChange={(h: string) => setNewStartTime(formatTime(h, newStartParsed.minutes))}
                  ariaLabel="Hora de entrada"
                  className="w-16"
                />
                <span className="text-lg font-semibold">:</span>
                <SpinWheel
                  values={MINUTE_VALUES}
                  value={newStartParsed.minutes}
                  onChange={(m: string) => setNewStartTime(formatTime(newStartParsed.hours, m))}
                  ariaLabel="Minutos de entrada"
                  className="w-16"
                />
              </div>
              <span className="text-muted-foreground">-</span>
              <div className="flex items-center gap-1">
                <SpinWheel
                  values={HOUR_VALUES}
                  value={newEndParsed.hours}
                  onChange={(h: string) => setNewEndTime(formatTime(h, newEndParsed.minutes))}
                  ariaLabel="Hora de salida"
                  className="w-16"
                />
                <span className="text-lg font-semibold">:</span>
                <SpinWheel
                  values={MINUTE_VALUES}
                  value={newEndParsed.minutes}
                  onChange={(m: string) => setNewEndTime(formatTime(newEndParsed.hours, m))}
                  ariaLabel="Minutos de salida"
                  className="w-16"
                />
              </div>
            </div>
            {overlapWarning && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm mt-4">
                El nuevo turno no puede coincidir con el turno actual
              </div>
            )}
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 mt-4"
              onClick={handleAddNewShift}
              disabled={busy || !!overlapWarning}
            >
              <Plus size={16} strokeWidth={1.8} />
              Añadir turno
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
