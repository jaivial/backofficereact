import React, { useCallback, useMemo } from "react";
import { Clock3 } from "lucide-react";

import type { Member } from "../../../../../api/types";
import { Modal } from "../../../../../ui/overlays/Modal";
import { SpinWheel } from "../../../../../ui/inputs/SpinWheel";
import { HOUR_OPTIONS, MINUTE_OPTIONS } from "../../constants";
import { fullName, fromMinutes, splitHHMM, toMinutes } from "../../utils";

interface ScheduleModalProps {
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
    () => HOUR_OPTIONS.filter((h) => Number(h) >= Number(entryHour)),
    [entryHour],
  );
  const exitMinuteOptions = useMemo(() => {
    if (Number(exitHour) !== Number(entryHour)) return MINUTE_OPTIONS;
    return MINUTE_OPTIONS.filter((m) => Number(m) >= Number(entryMinute));
  }, [entryHour, entryMinute, exitHour]);

  return (
    <Modal
      open={open}
      title="Asignar horario"
      onClose={onClose}
      widthPx={760}
      className="max-md:w-[95vw] md:w-[620px]"
    >
      <div className="bo-modalHead" data-slot="modalHead">
        <div className="bo-modalTitle" data-ui="modalTitle">Asignar horario</div>
        <button
          className="bo-modalX"
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-role="closeBtn"
        >
          ×
        </button>
      </div>

      <div className="bo-modalOutline sm:mt-3 mt-2" data-ui="modalContent">
        <div className="bo-panel bo-horariosModalPanel" data-role="modalPanel">
          <div className="bo-panelHead" data-slot="panelHead">
            <div data-slot="panelHeadInfo">
              <div className="bo-panelTitle text-sm sm:text-base" data-ui="memberName">
                {selectedMember ? fullName(selectedMember) : "Miembro"}
              </div>
              <div className="bo-panelMeta text-xs" data-ui="selectedDate">Fecha {selectedDate}</div>
            </div>
          </div>

          <div className="bo-panelBody bo-horariosModalBody sm:gap-4 gap-3" data-slot="panelBody">
            <div className="bo-horariosWheels" data-ui="wheelsGrid">
              <div className="bo-horariosWheelGroup" data-role="entryWheelCard">
                <div className="bo-label sm:text-xs text-[11px]" data-ui="entryLabel">Hora de entrada</div>
                <div className="bo-horariosWheelRow" data-slot="entryWheelsRow">
                  <div data-slot="entryHourCol">
                    <div className="bo-horariosWheelLabel sm:text-[11px] text-[10px]" data-ui="hourLabel">Hora</div>
                    <SpinWheel
                      className="bo-horariosWheelSpin"
                      values={HOUR_OPTIONS}
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
                      values={MINUTE_OPTIONS}
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
          </div>

          <div className="border-t border-[var(--bo-border)] bg-[var(--bo-surface)] px-4 py-3 sm:px-5 sm:py-4 flex flex-row-reverse gap-2 justify-start" data-ui="modalActions">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy || !selectedMember} onClick={onSave} data-role="saveBtn">
              Guardar horario
            </button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} data-role="cancelBtn">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
