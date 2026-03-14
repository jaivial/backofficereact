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
    return <div className="text-sm text-muted-foreground py-8 text-center">Sin registros para este miembro y fecha.</div>;
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const busy = busyEntryId === entry.id;
        return (
          <section key={entry.id} className="rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] p-4" aria-label={`Registro ${entry.id}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-foreground">
                <Clock3 size={14} strokeWidth={1.8} />
                <span>Registro #{entry.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${entry.source === "clock_autocut" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-muted text-muted-foreground"}`}>{entry.source}</span>
                {entry.isLive ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">En vivo</span> : null}
              </div>
            </div>

            <div className="space-y-3">
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
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">Fin</div>
                  <button className="inline-flex items-center justify-center gap-2 h-8 px-3 text-sm rounded-lg bg-transparent hover:bg-white/[0.06] bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm" type="button" onClick={() => onCloseLive(entry.id)} disabled={busy}>
                    Cerrar ahora
                  </button>
                </div>
              )}
            </div>

            <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-white/[0.06]">Total registrado: {minutesLabel(entry.minutesWorked)}</div>
          </section>
        );
      })}
    </div>
  );
}
