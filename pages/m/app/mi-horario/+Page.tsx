import React from "react";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../../state/atoms";
import { ChevronRight } from "lucide-react";

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

type ScheduleEntry = {
  day_of_week: number;
  entry_time: string | null;
  exit_time: string | null;
  role: string;
};

function formatHHMM(time: string | null): string {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

export default function MobileMiHorarioPage() {
  const session = useAtomValue(sessionAtom);

  // Placeholder schedule - in real implementation this comes from +data.ts
  const schedule: ScheduleEntry[] = React.useMemo(() => {
    if (!session) return [];
    // Placeholder: show Mon-Fri with 9:00-17:00
    return [1, 2, 3, 4, 5].map((day) => ({
      day_of_week: day,
      entry_time: "09:00",
      exit_time: "17:00",
      role: session.user.role,
    }));
  }, [session]);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-mi-horario">
      <header className="pt-2" data-ui="mobile-mi-horario-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-mi-horario-title">Mi Horario</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]" data-ui="mobile-mi-horario-subtitle">{session.user.name}</p>
      </header>

      <div className="flex flex-col gap-2" data-ui="mobile-mi-horario-list">
        {schedule.map((entry) => (
          <div
            key={entry.day_of_week}
            className="flex items-center justify-between p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
            data-ui="mobile-mi-horario-day"
            data-role={`day-${entry.day_of_week}`}
          >
            <div data-slot="mi-horario-div">
              <p className="text-sm font-bold text-[hsl(var(--foreground))]" data-ui="mobile-mi-horario-day-name">
                {DAYS_ES[entry.day_of_week]}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]" data-ui="mobile-mi-horario-role">{entry.role}</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]" data-slot="mi-horario-text-[hsl(var(-">
              <span data-ui="mobile-mi-horario-entry">{formatHHMM(entry.entry_time)}</span>
              <span className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" data-slot="mi-horario-text-[hsl(var(-">-</span>
              <span data-ui="mobile-mi-horario-exit">{formatHHMM(entry.exit_time)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
