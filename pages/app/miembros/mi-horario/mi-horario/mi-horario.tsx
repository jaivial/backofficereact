import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { CalendarDays, Clock3, Loader2, User } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { FichajeSchedule } from "../../../../../api/types";
import type { Data } from "../../mi-horario/+data";
import { useErrorToast } from "../../../../../ui/feedback/useErrorToast";
import { MONTH_NAMES } from "./constants";
import { diffHours, formatDate, pad2 } from "./helpers";

export default function MiHorarioPage() {
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

  return (
    <section aria-label="Mi Horario" className="bo-content-grid bo-miHorarioPage" data-ui="mi-horario-page">
      <div className="bo-panel bo-miHorarioPanel" data-ui="mi-horario-panel">
        <div className="bo-panelHead" data-ui="mi-horario-header">
          <div data-ui="mi-horario-title-group">
            <div className="bo-panelTitle" data-ui="mi-horario-title">
              <Clock3 size={16} strokeWidth={1.8} aria-hidden="true" data-ui="mi-horario-icon" />
              Mi Horario
            </div>
            <div className="bo-panelMeta" data-ui="mi-horario-meta">Consulta tus horarios asignados.</div>
          </div>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            type="button"
            onClick={() => void loadSchedules()}
            disabled={loading}
            data-ui="mi-horario-refresh-btn"
          >
            {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="bo-panelBody" data-ui="mi-horario-body">
          {error ? (
            <div className="bo-alert bo-alert--error" role="alert" data-ui="mi-horario-error">{error}</div>
          ) : sortedSchedules.length === 0 ? (
            <div className="bo-emptyState" data-ui="mi-horario-empty">
              <User size={48} strokeWidth={1} aria-hidden="true" data-ui="mi-horario-empty-icon" />
              <p data-ui="mi-horario-empty-title">No tienes horarios asignados.</p>
              <p className="bo-mutedText" data-ui="mi-horario-empty-hint">Contacta con tu responsable para que asigne tus turnos.</p>
            </div>
          ) : (
            <div className="bo-miHorarioList" data-ui="mi-horario-list">
              {Object.entries(groupedByMonth).map(([monthKey, monthSchedules]) => {
                const [year, month] = monthKey.split("-").map(Number);
                const monthName = MONTH_NAMES[month - 1];
                return (
                  <div key={monthKey} className="bo-miHorarioMonth" data-ui="mi-horario-month">
                    <div className="bo-miHorarioMonthHeader" data-ui="mi-horario-month-header">
                      {monthName} {year}
                    </div>
                    <div className="bo-miHorarioMonthGrid" data-ui="mi-horario-month-grid">
                      {monthSchedules.map((schedule) => (
                        <div key={schedule.id} className="bo-miHorarioCard" data-ui="mi-horario-card">
                          <div className="bo-miHorarioCardDate" data-ui="mi-horario-card-date">
                            <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" data-ui="mi-horario-card-date-icon" />
                            {formatDate(schedule.date)}
                          </div>
                          <div className="bo-miHorarioCardTime" data-ui="mi-horario-card-time">
                            <Clock3 size={14} strokeWidth={1.8} aria-hidden="true" data-ui="mi-horario-card-time-icon" />
                            {schedule.startTime} - {schedule.endTime}
                            <span className="bo-miHorarioCardDuration" data-ui="mi-horario-card-duration">
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
