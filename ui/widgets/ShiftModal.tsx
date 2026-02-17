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
      <div className="bo-shiftModal">
        {error && <div className="bo-shiftModalError">{error}</div>}

        {hasSchedule && !isActive && (
          <>
            <div className="bo-shiftModalSection">
              <div className="bo-shiftModalLabel">Turno actual</div>
              <div className="bo-shiftModalTimeRow">
                <div className="bo-shiftModalTimeBlock">
                  <button
                    type="button"
                    className="bo-btnIcon bo-btnIcon--sm"
                    aria-label="Restar 15 minutos a hora de entrada"
                    onClick={() => handleStartTimeAdjust(-15)}
                  >
                    <Minus size={14} strokeWidth={1.8} />
                  </button>
                  <div className="bo-shiftModalTime">{startTime}</div>
                  <button
                    type="button"
                    className="bo-btnIcon bo-btnIcon--sm"
                    aria-label="Sumar 15 minutos a hora de entrada"
                    onClick={() => handleStartTimeAdjust(15)}
                  >
                    <Plus size={14} strokeWidth={1.8} />
                  </button>
                </div>
                <span className="bo-shiftModalSeparator">-</span>
                <div className="bo-shiftModalTimeBlock">
                  <button
                    type="button"
                    className="bo-btnIcon bo-btnIcon--sm"
                    aria-label="Restar 15 minutos a hora de salida"
                    onClick={() => handleEndTimeAdjust(-15)}
                  >
                    <Minus size={14} strokeWidth={1.8} />
                  </button>
                  <div className="bo-shiftModalTime">{endTime}</div>
                  <button
                    type="button"
                    className="bo-btnIcon bo-btnIcon--sm"
                    aria-label="Sumar 15 minutos a hora de salida"
                    onClick={() => handleEndTimeAdjust(15)}
                  >
                    <Plus size={14} strokeWidth={1.8} />
                  </button>
                </div>
              </div>
              <div className="bo-shiftModalActions">
                <button
                  type="button"
                  className="bo-btn bo-btn--secondary"
                  onClick={handleUpdateSchedule}
                  disabled={busy}
                >
                  <Clock3 size={14} strokeWidth={1.8} />
                  Actualizar
                </button>
                <button
                  type="button"
                  className="bo-btn bo-btn--danger"
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
              className="bo-btn bo-btn--primary bo-btn--full"
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
                className="bo-btn bo-btn--primary bo-btn--full"
                onClick={() => setShowAssignForm(true)}
              >
                <Plus size={16} strokeWidth={1.8} />
                Asignar turno
              </button>
            ) : (
              <AnimatePresence>
                <motion.div
                  className="bo-shiftModalAssignForm"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bo-shiftModalLabel">Nuevo turno</div>
                  <div className="bo-shiftModalSpinWheels">
                    <div className="bo-shiftModalSpinWheelCol">
                      <SpinWheel
                        values={HOUR_VALUES}
                        value={newStartParsed.hours}
                        onChange={(h: string) => setNewStartTime(formatTime(h, newStartParsed.minutes))}
                        ariaLabel="Hora de entrada"
                        className="bo-shiftModalSpinWheel"
                      />
                      <span className="bo-shiftModalSpinWheelColon">:</span>
                      <SpinWheel
                        values={MINUTE_VALUES}
                        value={newStartParsed.minutes}
                        onChange={(m: string) => setNewStartTime(formatTime(newStartParsed.hours, m))}
                        ariaLabel="Minutos de entrada"
                        className="bo-shiftModalSpinWheel"
                      />
                    </div>
                    <span className="bo-shiftModalSeparator">-</span>
                    <div className="bo-shiftModalSpinWheelCol">
                      <SpinWheel
                        values={HOUR_VALUES}
                        value={newEndParsed.hours}
                        onChange={(h: string) => setNewEndTime(formatTime(h, newEndParsed.minutes))}
                        ariaLabel="Hora de salida"
                        className="bo-shiftModalSpinWheel"
                      />
                      <span className="bo-shiftModalSpinWheelColon">:</span>
                      <SpinWheel
                        values={MINUTE_VALUES}
                        value={newEndParsed.minutes}
                        onChange={(m: string) => setNewEndTime(formatTime(newEndParsed.hours, m))}
                        ariaLabel="Minutos de salida"
                        className="bo-shiftModalSpinWheel"
                      />
                    </div>
                  </div>
                  {overlapWarning && (
                    <div className="bo-shiftModalWarning">
                      El nuevo turno no puede coincidir con el turno actual
                    </div>
                  )}
                  <button
                    type="button"
                    className="bo-btn bo-btn--primary bo-btn--full"
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
                className="bo-btn bo-btn--primary bo-btn--full"
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
            <div className="bo-shiftModalSection">
              <div className="bo-shiftModalLabel">Fichaje activo</div>
              <div className="bo-shiftModalActiveBadge">
                <span className="bo-badge bo-badge--success">En vivo</span>
                <span className="bo-shiftModalActiveTime">
                  Entrada: {activeEntry?.startTime || "--:--"}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="bo-btn bo-btn--danger bo-btn--full"
              onClick={handleClockOut}
              disabled={busy}
            >
              <Square size={16} strokeWidth={1.8} />
              Fichar salida
            </button>
          </>
        )}

        {hasSchedule && isActive && (
          <div className="bo-shiftModalAddShift">
            <div className="bo-shiftModalLabel">Añadir otro turno</div>
            <div className="bo-shiftModalSpinWheels">
              <div className="bo-shiftModalSpinWheelCol">
                <SpinWheel
                  values={HOUR_VALUES}
                  value={newStartParsed.hours}
                  onChange={(h: string) => setNewStartTime(formatTime(h, newStartParsed.minutes))}
                  ariaLabel="Hora de entrada"
                  className="bo-shiftModalSpinWheel"
                />
                <span className="bo-shiftModalSpinWheelColon">:</span>
                <SpinWheel
                  values={MINUTE_VALUES}
                  value={newStartParsed.minutes}
                  onChange={(m: string) => setNewStartTime(formatTime(newStartParsed.hours, m))}
                  ariaLabel="Minutos de entrada"
                  className="bo-shiftModalSpinWheel"
                />
              </div>
              <span className="bo-shiftModalSeparator">-</span>
              <div className="bo-shiftModalSpinWheelCol">
                <SpinWheel
                  values={HOUR_VALUES}
                  value={newEndParsed.hours}
                  onChange={(h: string) => setNewEndTime(formatTime(h, newEndParsed.minutes))}
                  ariaLabel="Hora de salida"
                  className="bo-shiftModalSpinWheel"
                />
                <span className="bo-shiftModalSpinWheelColon">:</span>
                <SpinWheel
                  values={MINUTE_VALUES}
                  value={newEndParsed.minutes}
                  onChange={(m: string) => setNewEndTime(formatTime(newEndParsed.hours, m))}
                  ariaLabel="Minutos de salida"
                  className="bo-shiftModalSpinWheel"
                />
              </div>
            </div>
            {overlapWarning && (
              <div className="bo-shiftModalWarning">
                El nuevo turno no puede coincidir con el turno actual
              </div>
            )}
            <button
              type="button"
              className="bo-btn bo-btn--secondary bo-btn--full"
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
