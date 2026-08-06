import React, { useMemo } from "react";
import { Clock, Pencil } from "lucide-react";

import type { FichajeSchedule, Member } from "../../../../../../api/types";
import { formatDateHeader } from "../../helpers/index";

export type DailyScheduleCardProps = {
  date: string;
  /** All schedules for this member on this date (multi-shift days supported). */
  schedules: FichajeSchedule[];
  /** The member whose schedule this card shows; enables the shift editor. */
  member?: Member;
  /** Opens the shift editor for this date. Required when member is set. */
  onEdit?: (date: string) => void;
  className?: string;
};

export function DailyScheduleCard({ date, schedules = [], member, onEdit, className = "" }: DailyScheduleCardProps) {
  const formattedDate = useMemo(() => formatDateHeader(date), [date]);
  const memberName = member ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || `Miembro #${member.id}` : "";
  const canEdit = !!member && !!onEdit;
  const ordered = useMemo(
    () => [...schedules].sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedules],
  );

  return (
    <>
      <style>{`
        [data-theme="dark"] [data-ui="dailyScheduleCard"] {
          background: linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 10%, transparent), transparent 55%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(0, 0, 0, 0.16)),
            color-mix(in srgb, var(--bo-surface-2) 78%, transparent) !important;
          border-color: var(--bo-glass-border-strong) !important;
          box-shadow: var(--bo-glass-shadow) !important;
          backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
          -webkit-backdrop-filter: blur(var(--bo-glass-blur)) saturate(118%) !important;
        }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-icon { color: rgba(255,255,255,0.60); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-date { color: rgba(255,255,255,0.80); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-separator { background: rgba(255,255,255,0.10); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-time { color: rgba(255,255,255,0.90); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-break { color: rgba(255,255,255,0.50); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-empty { color: rgba(255,255,255,0.40); }
        [data-theme="dark"] [data-ui="dailyScheduleCard"] .card-shift { background: rgba(255,255,255,0.06); }
      `}</style>
    <div
      data-ui="dailyScheduleCard"
      className={`rounded-xl border border-solid !p-4 ${className}`}
      style={{
        background: "linear-gradient(140deg, color-mix(in srgb, var(--bo-accent) 8%, white), transparent 60%), linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(242, 244, 251, 0.76)), color-mix(in srgb, var(--bo-surface) 90%, transparent)",
        boxShadow: "0 8px 24px rgba(124, 92, 231, 0.06), 0 2px 6px rgba(0, 0, 0, 0.04)",
        borderColor: "color-mix(in srgb, var(--bo-accent) 16%, var(--bo-border))",
      }}
    >
      <div data-slot="cardHeader" className="flex items-center gap-2 mb-3">
        <Clock data-slot="icon" size={16} strokeWidth={1.8} className="card-icon text-purple-400" aria-hidden="true" />
        <span data-slot="dateLabel" className="card-date text-sm font-medium text-purple-900 capitalize">
          {formattedDate}
        </span>
        {canEdit ? (
          <button
            type="button"
            onClick={() => onEdit?.(date)}
            aria-label={`Editar horario de ${memberName} el ${formattedDate}`}
            title="Editar horario"
            data-role="daily-schedule-edit"
            className="bo-dateBtn bo-dateBtn--glass !justify-center !h-7 !w-7 !p-0 ml-auto"
          >
            <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div data-slot="separator" className="card-separator h-px mb-3" aria-hidden="true" />

      <div data-slot="scheduleList" className="flex flex-col gap-2">
        {ordered.length === 0 ? (
          <span data-slot="noSchedule" className="card-empty text-sm italic text-[var(--bo-faint)]">
            Sin horario
          </span>
        ) : (
          ordered.map((schedule) => (
            <div
              key={schedule.id}
              data-slot="scheduleRow"
              className="card-shift flex items-center gap-2 rounded-lg border border-solid border-[color-mix(in_srgb,var(--bo-accent)_14%,var(--bo-border))] px-3 py-2"
            >
              <span data-slot="timeRange" className="card-time text-sm font-semibold tabular-nums text-[var(--bo-text)]">
                {schedule.startTime} - {schedule.endTime}
              </span>
              {schedule.breakMinutes && schedule.breakMinutes > 0 ? (
                <span data-slot="breakInfo" className="card-break text-xs text-[var(--bo-faint)]">
                  ({schedule.breakMinutes}min pausa)
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
    </>
  );
}
