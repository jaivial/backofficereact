import React from "react";
import { useAtomValue } from "jotai";
import { ClipboardList, Users } from "lucide-react";
import { sessionAtom } from "../../../../state/atoms";
import { usePageContext } from "vike-react/usePageContext";

type ScheduleEntry = {
  member_name: string;
  role: string;
  entry_time: string | null;
  exit_time: string | null;
};

type HorariosData = {
  entries: ScheduleEntry[];
  date: string;
};

function formatHHMM(time: string | null): string {
  if (!time) return "--:--";
  return time.slice(0, 5);
}

export default function MobileHorariosPage() {
  const session = useAtomValue(sessionAtom);
  const pageContext = usePageContext();
  const data = (pageContext.data ?? { entries: [], date: "" }) as HorariosData;

  const dateLabel = React.useMemo(() => {
    const d = data.date ? new Date(data.date + "T00:00:00") : new Date();
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }, [data.date]);

  if (!session) return null;

  return (
    <div className="flex flex-col gap-4 p-4" data-ui="mobile-horarios">
      <header className="pt-2" data-ui="mobile-horarios-header">
        <h1 className="text-xl font-bold text-[hsl(var(--foreground))]" data-ui="mobile-horarios-title">Horarios</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] capitalize" data-ui="mobile-horarios-date">{dateLabel}</p>
      </header>

      {data.entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center" data-ui="mobile-horarios-empty">
          <ClipboardList size={40} strokeWidth={1.5} className="text-[hsl(var(--muted-foreground))] mb-3" aria-hidden="true" />
          <p className="text-[hsl(var(--muted-foreground))] text-sm" data-slot="horarios-text-sm">No hay personal asignado hoy</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-ui="mobile-horarios-list" role="list">
          {data.entries.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
              data-ui="mobile-horario-entry"
              data-role="horario-entry"
            >
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0" aria-hidden="true" data-slot="horarios-flex-shrink-0">
                <Users size={18} className="text-[hsl(var(--primary))]" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0" data-slot="horarios-min-w-0">
                <p className="text-sm font-bold text-[hsl(var(--foreground))] truncate" data-ui="mobile-horario-name">{entry.member_name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]" data-ui="mobile-horario-role">{entry.role}</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))] flex-shrink-0" data-ui="mobile-horario-times">
                <span data-ui="mobile-horario-entry-time">{formatHHMM(entry.entry_time)}</span>
                <span className="text-[hsl(var(--muted-foreground))]" aria-hidden="true" data-slot="horarios-text-[hsl(var(-">-</span>
                <span data-ui="mobile-horario-exit-time">{formatHHMM(entry.exit_time)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
