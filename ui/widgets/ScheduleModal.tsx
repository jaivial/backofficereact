import React, { useMemo } from "react";
import { Clock3 } from "lucide-react";

import type { Member } from "../../api/types";
import { fullName } from "../../lib/member";
import { Modal } from "../overlays/Modal";
import { ModalHeader } from "../overlays/ModalHeader";
import { Panel } from "../shell/Panel";
import { SpinWheel } from "../inputs/SpinWheel";

export const SCHEDULE_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const SCHEDULE_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

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
  return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0") };
}

export interface ScheduleModalProps {
  open: boolean;
  selectedMember: Member | null;
  selectedDate: string;
  entryHour: string;
  entryMinute: string;
  exitHour: string;
  exitMinute: string;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
  onSetEntryTime: (hour: string, minute: string) => void;
  onSetExitHour: (hour: string) => void;
  onSetExitMinute: (minute: string) => void;
}

export function ScheduleModal({
  open,
  selectedMember,
  selectedDate,
  entryHour,
  entryMinute,
  exitHour,
  exitMinute,
  busy,
  onClose,
  onSave,
  onSetEntryTime,
  onSetExitHour,
  onSetExitMinute,
}: ScheduleModalProps) {
  const exitHourOptions = useMemo(
    () => SCHEDULE_HOUR_OPTIONS.filter((h) => Number(h) >= Number(entryHour)),
    [entryHour],
  );
  const exitMinuteOptions = useMemo(() => {
    if (Number(exitHour) !== Number(entryHour)) return SCHEDULE_MINUTE_OPTIONS;
    return SCHEDULE_MINUTE_OPTIONS.filter((m) => Number(m) >= Number(entryMinute));
  }, [entryHour, entryMinute, exitHour]);

  return (
    <Modal
      open={open}
      title="Asignar horario"
      onClose={onClose}
      widthPx={760}
      className="max-md:w-[95vw] md:w-[620px]"
    >
      <ModalHeader title="Asignar horario" onClose={onClose} />

      <div className="bo-modalOutline sm:mt-3 mt-2" data-ui="modalContent">
        <Panel
          className="bo-horariosModalPanel"
          data-role="modalPanel"
          title={<span className="text-sm sm:text-base">{selectedMember ? fullName(selectedMember) : "Miembro"}</span>}
          meta={<span className="text-xs">Fecha {selectedDate}</span>}
          bodyClassName="bo-horariosModalBody sm:gap-4 gap-3"
        >
          <div className="bo-horariosWheels" data-ui="wheelsGrid">
            <div className="bo-horariosWheelGroup" data-role="entryWheelCard">
              <div className="bo-label sm:text-xs text-[11px]" data-ui="entryLabel">Hora de entrada</div>
              <div className="bo-horariosWheelRow" data-slot="entryWheelsRow">
                <div data-slot="entryHourCol">
                  <div className="bo-horariosWheelLabel sm:text-[11px] text-[10px]" data-ui="hourLabel">Hora</div>
                  <SpinWheel
                    className="bo-horariosWheelSpin"
                    values={SCHEDULE_HOUR_OPTIONS}
                    value={entryHour}
                    onChange={(nextHour: string) => onSetEntryTime(nextHour, entryMinute)}
                    ariaLabel="Hora de entrada"
                    size="sm"
                  />
                </div>
                <div data-slot="entryMinuteCol">
                  <div className="bo-horariosWheelLabel sm:text-[11px] text-[10px]" data-ui="minuteLabel">Minutos</div>
                  <SpinWheel
                    className="bo-horariosWheelSpin"
                    values={SCHEDULE_MINUTE_OPTIONS}
                    value={entryMinute}
                    onChange={(nextMinute: string) => onSetEntryTime(entryHour, nextMinute)}
                    ariaLabel="Minutos de entrada"
                    size="sm"
                  />
                </div>
              </div>
            </div>

            <div className="bo-horariosWheelGroup" data-role="exitWheelCard">
              <div className="bo-label sm:text-xs text-[11px]" data-ui="exitLabel">Hora de salida</div>
              <div className="bo-horariosWheelRow" data-slot="exitWheelsRow">
                <div data-slot="exitHourCol">
                  <div className="bo-horariosWheelLabel sm:text-[11px] text-[10px]" data-ui="exitHourLabel">Hora</div>
                  <SpinWheel
                    className="bo-horariosWheelSpin"
                    values={exitHourOptions}
                    value={exitHour}
                    onChange={onSetExitHour}
                    ariaLabel="Hora de salida"
                    size="sm"
                  />
                </div>
                <div data-slot="exitMinuteCol">
                  <div className="bo-horariosWheelLabel sm:text-[11px] text-[10px]" data-ui="exitMinuteLabel">Minutos</div>
                  <SpinWheel
                    className="bo-horariosWheelSpin"
                    values={exitMinuteOptions}
                    value={exitMinute}
                    onChange={onSetExitMinute}
                    ariaLabel="Minutos de salida"
                    size="sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bo-horariosPreview sm:text-sm text-xs sm:py-2.5 sm:px-3 py-2 px-2.5" data-ui="timePreview">
            <Clock3 className="sm:w-3.5 sm:h-3.5 w-3 h-3" strokeWidth={1.8} data-slot="previewIcon" />
            {`${entryHour}:${entryMinute}`} - {`${exitHour}:${exitMinute}`}
          </div>

          <div className="border-t border-[var(--bo-border)] bg-[var(--bo-surface)] px-4 py-3 sm:px-5 sm:py-4 flex flex-row-reverse gap-2 justify-start" data-ui="modalActions">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy || !selectedMember} onClick={onSave} data-role="saveBtn">
              Guardar horario
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} data-role="cancelBtn">
              Cancelar
            </button>
          </div>
        </Panel>
      </div>
    </Modal>
  );
}

export { splitHHMM, toMinutes, fromMinutes };
