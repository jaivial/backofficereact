import React from "react";
import { Clock3 } from "lucide-react";

import { cn } from "../shadcn/utils";
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
  className,
}: {
  entries: EditableTimeEntry[];
  busyEntryId: number | null;
  onShiftStart: (entryId: number, deltaMinutes: number) => void;
  onShiftEnd: (entryId: number, deltaMinutes: number) => void;
  onCloseLive: (entryId: number) => void;
  className?: string;
}) {
  if (entries.length === 0) {
    return <div className="bo-mutedText bo-timeEntriesEmpty" data-slot="time-entries-empty">Sin registros para este miembro y fecha.</div>;
  }

  return (
    <div className={cn("bo-timeEntriesList", className)} data-slot="time-entries-list">
      {entries.map((entry) => {
        const busy = busyEntryId === entry.id;
        return (
          <section key={entry.id} className="bo-timeEntryCard bo-timeEntryCard--glass" aria-label={`Registro ${entry.id}`} data-testid="time-entry-section" data-slot="time-entry-card">
            <div className="bo-timeEntryHead" data-slot="time-entry-header">
              <div className="bo-timeEntryHeadLeft" data-slot="time-entry-header-left">
                <Clock3 size={14} strokeWidth={1.8} />
                <span data-slot="time-entry-label">Registro #{entry.id}</span>
              </div>
              <div className="bo-timeEntryHeadRight" data-slot="time-entry-header-right">
                <span className={cn("bo-badge", "bo-timeEntrySource", entry.source === "clock_autocut" && "is-warning")} data-slot="time-entry-source">{entry.source}</span>
                {entry.isLive ? <span className="bo-badge bo-timeEntryLive" data-slot="time-entry-live-badge">En vivo</span> : null}
              </div>
            </div>

            <div className="bo-timeEntryBody" data-slot="time-entry-body">
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
                <div className="bo-timeEntryLiveActions" data-slot="time-entry-live-actions">
                  <div className="bo-timeAdjustLabel" data-slot="time-entry-end-label">Fin</div>
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass" type="button" onClick={() => onCloseLive(entry.id)} disabled={busy} data-testid="time-entry-close-live" data-slot="time-entry-close-btn">
                    Cerrar ahora
                  </button>
                </div>
              )}
            </div>

            <div className="bo-timeEntryFoot" data-slot="time-entry-footer">Total registrado: {minutesLabel(entry.minutesWorked)}</div>
          </section>
        );
      })}
    </div>
  );
}
