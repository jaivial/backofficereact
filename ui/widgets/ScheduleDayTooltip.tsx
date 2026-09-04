import React from "react";

import type { HorariosCalendarDay } from "../../api/types";
import { Avatar, AvatarFallback, AvatarImage } from "../shell/Avatar";
import { cn } from "../shadcn/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "??";
  return (parts[0][0] + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

type Props = {
  dayData: HorariosCalendarDay;
  className?: string;
  style?: React.CSSProperties;
};

export function ScheduleDayTooltip({ dayData, className, style }: Props) {
  return (
    <div
      className={cn(
        "w-64 rounded-xl border border-[var(--bo-border)] bg-[var(--bo-surface)] shadow-lg p-3",
        className,
      )}
      style={style}
      data-testid="calendar-day-popover"
    >
      <div data-slot="scheduleDayTooltip-mb-2" className="text-xs font-semibold text-[var(--bo-muted)] mb-2">
        {new Date(dayData.date + "T12:00:00").toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </div>

      {dayData.workers.length === 0 ? (
        <div data-slot="scheduleDayTooltip-text-center" className="text-xs text-[var(--bo-faint)] py-2 text-center">
          Sin horarios asignados
        </div>
      ) : (
        <div data-slot="scheduleDayTooltip-overflow-y-auto" className="space-y-2 max-h-48 overflow-y-auto">
          {dayData.workers.map((worker) => (
            <div data-slot="scheduleDayTooltip-hover:bg-white/5" key={worker.memberId} className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/5">
              <Avatar className="w-7 h-7 rounded-full flex-shrink-0">
                {worker.photoUrl ? (
                  <AvatarImage src={worker.photoUrl} alt={worker.memberName} />
                ) : null}
                <AvatarFallback className="text-[10px]">{initials(worker.memberName)}</AvatarFallback>
              </Avatar>
              <div data-slot="scheduleDayTooltip-flex-1" className="min-w-0 flex-1">
                <div data-slot="scheduleDayTooltip-truncate" className="text-sm font-medium leading-tight truncate">{worker.memberName}</div>
                <div data-slot="scheduleDayTooltip-mt-0.5" className="text-[11px] text-[var(--bo-muted)] leading-tight mt-0.5">
                  {worker.schedules.map((s, i) => (
                    <span data-slot="scheduleDayTooltip-span" key={i}>
                      {i > 0 && <span className="mx-1">·</span>}
                      {s.startTime} - {s.endTime}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
