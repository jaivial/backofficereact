import React from "react";
import { Clock3 } from "lucide-react";

import { TimeAdjustCounter } from "./TimeAdjustCounter";

export type EditableTimeEntry = {
  id: number;
  startTime: string;
  endTime: string | null;
  minutesWorked: number;
  source: string;
  isLive: boolean;
};

function minutesLabel(total: number): string {
  const safe = Math.max(0, Math.floor(total));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function TimeEntriesEditor({
  entries,
  busyEntryId,
  onShiftStart,
  onShiftEnd,
  onCloseLive,
}: {
  entries: EditableTimeEntry[];
  busyEntryId: number | null;
  onShiftStart: (entryId: number, deltaMinutes: number) => void;
  onShiftEnd: (entryId: number, deltaMinutes: number) => void;
  onCloseLive: (entryId: number) => void;
}) {
  if (entries.length === 0) {
    return <div className="bo-mutedText bo-timeEntriesEmpty">Sin registros para este miembro y fecha.</div>;
  }

  return (
    <div className="bo-timeEntriesList">
      {entries.map((entry) => {
        const busy = busyEntryId === entry.id;
        return (
          <section key={entry.id} className="bo-timeEntryCard bo-timeEntryCard--glass" aria-label={`Registro ${entry.id}`}>
            <div className="bo-timeEntryHead">
              <div className="bo-timeEntryHeadLeft">
                <Clock3 size={14} strokeWidth={1.8} />
                <span>Registro #{entry.id}</span>
              </div>
              <div className="bo-timeEntryHeadRight">
                <span className={`bo-badge bo-timeEntrySource${entry.source === "clock_autocut" ? " is-warning" : ""}`}>{entry.source}</span>
                {entry.isLive ? <span className="bo-badge bo-timeEntryLive">En vivo</span> : null}
              </div>
            </div>

            <div className="bo-timeEntryBody">
              <TimeAdjustCounter
                label="Inicio"
                value={entry.startTime}
                onMinus={() => onShiftStart(entry.id, -15)}
                onPlus={() => onShiftStart(entry.id, 15)}
                disabled={busy || entry.isLive}
              />

              {entry.endTime ? (
                <TimeAdjustCounter
                  label="Fin"
                  value={entry.endTime}
                  onMinus={() => onShiftEnd(entry.id, -15)}
                  onPlus={() => onShiftEnd(entry.id, 15)}
                  disabled={busy}
                />
              ) : (
                <div className="bo-timeEntryLiveActions">
                  <div className="bo-timeAdjustLabel">Fin</div>
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass" type="button" onClick={() => onCloseLive(entry.id)} disabled={busy}>
                    Cerrar ahora
                  </button>
                </div>
              )}
            </div>

            <div className="bo-timeEntryFoot">Total registrado: {minutesLabel(entry.minutesWorked)}</div>
          </section>
        );
      })}
    </div>
  );
}
