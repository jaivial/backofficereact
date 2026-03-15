import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarDays, Clock3, User } from "lucide-react";

import { createClient } from "../../../../api/client";
import type { FichajeSchedule } from "../../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const weekdays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const weekday = weekdays[d.getDay()];
  return `${weekday}, ${pad2(day)}/${pad2(month)}/${year}`;
}

function diffHours(start: string, end: string): string {
  const [sh, sm] = start.split(":").map((v) => Number(v));
  const [eh, em] = end.split(":").map((v) => Number(v));
  if (![sh, sm, eh, em].every((v) => Number.isFinite(v))) return "--";
  const minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);

  const [schedules, setSchedules] = useState<FichajeSchedule[]>(data.schedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.horarios.getMySchedule();
      if (res.success) {
        setSchedules(res.schedules);
      } else {
        setError(res.message || "Error cargando horarios");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando horarios");
    } finally {
      setLoading(false);
    }
  }, [api.horarios]);

  useEffect(() => {
    if (data.error) return;
    // Refresh schedules every minute
    const interval = setInterval(loadSchedules, 60000);
    return () => clearInterval(interval);
  }, [loadSchedules, data.error]);

  const sortedSchedules = useMemo(() => {
    return [...schedules].sort((a, b) => a.date.localeCompare(b.date));
  }, [schedules]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, FichajeSchedule[]> = {};
    for (const schedule of sortedSchedules) {
      const date = new Date(schedule.date + "T00:00:00");
      const key = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(schedule);
    }
    return groups;
  }, [sortedSchedules]);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div className="rounded-[var(--rounded-lg)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.13)),var(--bo-surface)] border-none shadow-[var(--shadow-soft)]" aria-label="Mi Horario">
      <div className="flex items-end justify-between p-[16px_18px_10px]">
        <div>
          <div className="text-sm font-bold flex items-center gap-2">
            <Clock3 size={16} strokeWidth={1.8} />
            Mi Horario
          </div>
          <div className="text-xs text-[var(--text-faint)]">Consulta tus horarios asignados.</div>
        </div>
        <button
          className="h-8 px-[10px] rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 border border-[var(--border)] bg-transparent text-bo-text cursor-pointer leading-none whitespace-nowrap"
          onClick={() => void loadSchedules()}
          disabled={loading}
        >
          {loading ? "Cargando..." : "Actualizar"}
        </button>
      </div>

      <div className="p-0 [18px_16px]">
        {error ? (
          <div className="mt-3 rounded-md border border-[rgba(220,53,69,0.32)] bg-[rgba(220,53,69,0.10)] p-3" role="alert">{error}</div>
        ) : sortedSchedules.length === 0 ? (
          <div className="grid justify-items-center text-center gap-3 p-6 rounded-md border border-dashed border-[var(--border-2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(0,0,0,0.12)),var(--bo-surface-2)] text-[var(--text-muted)]">
            <div className="text-[var(--text-faint)]">
              <User size={48} strokeWidth={1} />
            </div>
            <div className="text-base font-semibold leading-tight m-0">No tienes horarios asignados.</div>
            <div className="text-sm text-[var(--text-muted)]">Contacta con tu responsable para que asigne tus turnos.</div>
          </div>
        ) : (
          <div className="flex flex-col gap-[18px]">
            {Object.entries(groupedByMonth).map(([monthKey, monthSchedules]) => {
              const [year, month] = monthKey.split("-").map(Number);
              const monthName = monthNames[month - 1];
              return (
                <div key={monthKey}>
                  <div className="bo-scheduleMonthHeader">
                    {monthName} {year}
                  </div>
                  <div className="bo-scheduleGrid">
                    {monthSchedules.map((schedule) => (
                      <div key={schedule.id} className="bo-scheduleItem">
                        <div className="flex items-center gap-2 bo-scheduleItemText">
                          <CalendarDays size={14} strokeWidth={1.8} />
                          {formatDate(schedule.date)}
                        </div>
                        <div className="flex items-center gap-2 bo-scheduleItemText">
                          <Clock3 size={14} strokeWidth={1.8} />
                          {schedule.startTime} - {schedule.endTime}
                          <span className="bo-scheduleHours">
                            ({diffHours(schedule.startTime, schedule.endTime)})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
