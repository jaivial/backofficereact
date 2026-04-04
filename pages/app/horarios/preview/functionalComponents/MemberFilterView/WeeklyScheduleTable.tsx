import React from "react";
import { CalendarDays } from "lucide-react";

import type { FichajeSchedule } from "../../../../../../api/types";
import type { WeeklyScheduleTableProps } from "./types";

import { formatWeekHeader, getDayName } from "../../helpers";

export function WeeklyScheduleTable({
  weekGroups,
  schedulesByDate,
  className,
}: WeeklyScheduleTableProps) {
  return (
    <>
      <style>{`
        [data-theme="dark"] [data-ui="weekBlock"] {
          background: linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 10%, transparent), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.16)),
            color-mix(in srgb, var(--bo-surface-2) 78%, transparent) !important;
          border-color: var(--bo-glass-border-strong) !important;
          box-shadow: var(--bo-glass-shadow) !important;
          backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
          -webkit-backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
        }
        [data-theme="dark"] [data-ui="weekBlock"] .week-icon { color: rgba(255,255,255,0.60); }
        [data-theme="dark"] [data-ui="weekBlock"] .week-label { color: rgba(255,255,255,0.80); }
        [data-theme="dark"] [data-ui="weekBlock"] .week-separator { background: rgba(255,255,255,0.10); }
        [data-theme="dark"] [data-ui="weekBlock"] th { color: rgba(255,255,255,0.50); }
        [data-theme="dark"] [data-ui="weekBlock"] td { color: rgba(255,255,255,0.70); }
        [data-theme="dark"] [data-ui="weekBlock"] .day-name { color: rgba(255,255,255,0.80); }
        [data-theme="dark"] [data-ui="weekBlock"] .schedule-time { color: rgba(255,255,255,0.80); }
        [data-theme="dark"] [data-ui="weekBlock"] .schedule-break { color: rgba(255,255,255,0.50); }
        [data-theme="dark"] [data-ui="weekBlock"] .no-schedule { color: rgba(255,255,255,0.40); }
        [data-theme="dark"] [data-ui="weekBlock"] tr { border-color: rgba(255,255,255,0.05); }
      `}</style>
    <div
      data-ui="weeklyScheduleTable"
      className={`space-y-6 ${className}`}
    >
      {weekGroups.map((week) => (
        <div key={week.monday} data-ui="weekBlock" className="rounded-xl border border-solid p-4"
          style={{
            background: "linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 8%, white), transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(242, 244, 251, 0.76)), color-mix(in srgb, var(--bo-surface) 90%, transparent)",
            boxShadow: "0 8px 24px rgba(124, 92, 231, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)",
            borderColor: "color-mix(in srgb, var(--bo-accent) 16%, var(--bo-border))",
          }}
        >
          <div data-slot="weekHeader" className="flex items-center gap-2 mb-3">
            <CalendarDays data-slot="icon" size={16} strokeWidth={1.8} className="week-icon text-purple-400" aria-hidden="true" />
            <span data-slot="weekLabel" className="week-label text-sm font-medium text-purple-900">
              {formatWeekHeader(week.monday, week.sunday)}
            </span>
          </div>

          <div data-slot="separator" className="week-separator h-px mb-3" aria-hidden="true" />

          <table data-slot="table" className="w-full text-sm">
            <thead>
              <tr>
                <th data-col="day" className="text-left font-normal pb-2 pr-4 w-32 text-purple-500 text-xs font-medium uppercase tracking-wide">
                  Día
                </th>
                <th data-col="schedule" className="text-left font-normal pb-2 text-purple-500 text-xs font-medium uppercase tracking-wide">
                  Horario
                </th>
              </tr>
            </thead>
            <tbody>
              {week.dates.map((date) => {
                const schedule = schedulesByDate.get(date);
                const dayName = getDayName(date);
                const dayNum = new Date(date).getDate();

                return (
                  <tr key={date} data-row="scheduleRow" className="border-t border-purple-50 first:border-t-0">
                    <td data-col="dayCell" className="py-2 pr-4 capitalize day-name text-purple-900 font-medium">
                      {dayName} {dayNum}
                    </td>
                    <td data-col="scheduleCell" className="py-2">
                      {schedule ? (
                        <span data-slot="scheduleInfo" className="schedule-time text-zinc-700 font-medium">
                          {schedule.startTime} - {schedule.endTime}
                          {schedule.breakMinutes && schedule.breakMinutes > 0 ? (
                            <span data-slot="breakInfo" className="schedule-break text-xs ml-2 text-zinc-400">
                              ({schedule.breakMinutes}min pausa)
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span data-slot="noSchedule" className="no-schedule italic text-zinc-400">
                          Sin horario
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {weekGroups.length === 0 ? (
        <div data-ui="emptyState" className="text-center py-8 text-zinc-400">
          Selecciona un rango de fechas para ver el horario semanal
        </div>
      ) : null}
    </div>
    </>
  );
}
