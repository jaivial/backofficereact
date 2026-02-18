import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarDays, Clock3, User } from "lucide-react";

import { createClient } from "../../../api/client";
import type { FichajeSchedule } from "../../../api/types";
import type { Data } from "./+data";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";

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
    <section aria-label="Mi Horario" className="bo-content-grid bo-miHorarioPage">
      <div className="bo-panel bo-miHorarioPanel">
        <div className="bo-panelHead">
          <div>
            <div className="bo-panelTitle">
              <Clock3 size={16} strokeWidth={1.8} />
              Mi Horario
            </div>
            <div className="bo-panelMeta">Consulta tus horarios asignados.</div>
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            onClick={() => void loadSchedules()}
            disabled={loading}
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="bo-panelBody">
          {error ? (
            <div className="bo-alert bo-alert--error">{error}</div>
          ) : sortedSchedules.length === 0 ? (
            <div className="bo-emptyState">
              <User size={48} strokeWidth={1} />
              <p>No tienes horarios asignados.</p>
              <p className="bo-mutedText">Contacta con tu responsable para que asigne tus turnos.</p>
            </div>
          ) : (
            <div className="bo-miHorarioList">
              {Object.entries(groupedByMonth).map(([monthKey, monthSchedules]) => {
                const [year, month] = monthKey.split("-").map(Number);
                const monthName = monthNames[month - 1];
                return (
                  <div key={monthKey} className="bo-miHorarioMonth">
                    <div className="bo-miHorarioMonthHeader">
                      {monthName} {year}
                    </div>
                    <div className="bo-miHorarioMonthGrid">
                      {monthSchedules.map((schedule) => (
                        <div key={schedule.id} className="bo-miHorarioCard">
                          <div className="bo-miHorarioCardDate">
                            <CalendarDays size={14} strokeWidth={1.8} />
                            {formatDate(schedule.date)}
                          </div>
                          <div className="bo-miHorarioCardTime">
                            <Clock3 size={14} strokeWidth={1.8} />
                            {schedule.startTime} - {schedule.endTime}
                            <span className="bo-miHorarioCardDuration">
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
    </section>
  );
}
