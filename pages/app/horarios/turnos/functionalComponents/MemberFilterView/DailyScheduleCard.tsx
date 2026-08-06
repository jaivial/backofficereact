import React, { useMemo } from "react";
import { Clock, Pencil, Plus } from "lucide-react";

import type { FichajeSchedule, Member } from "../../../../../../api/types";
import { formatDateHeader } from "../../helpers/index";

export type DailyScheduleCardProps = {
  date: string;
  schedule: FichajeSchedule | null;
  /** The member whose schedule this card shows; enables the shift editor. */
  member?: Member;
  /** Opens the shift editor for this date. Required when member is set. */
  onEdit?: (date: string) => void;
  className?: string;
};

export function DailyScheduleCard({ date, schedule, member, onEdit, className = "" }: DailyScheduleCardProps) {
  const formattedDate = useMemo(() => formatDateHeader(date), [date]);
  const memberName = member ? `${member.firstName || ""} ${member.lastName || ""}`.trim() || `Miembro #${member.id}` : "";
  const canEdit = !!member && !!onEdit;

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
      </div>

      <div data-slot="separator" className="card-separator h-px mb-3" aria-hidden="true" />

      <div data-slot="scheduleContent">
        {schedule ? (
          <div data-slot="scheduleInfo" className="flex items-center gap-3">
            <span data-slot="timeRange" className="card-time text-lg font-semibold text-[var(--bo-text)]">
              {schedule.startTime} - {schedule.endTime}
            </span>
            {schedule.breakMinutes && schedule.breakMinutes > 0 ? (
              <span data-slot="breakInfo" className="card-break text-xs text-[var(--bo-faint)]">
                ({schedule.breakMinutes}min pausa)
              </span>
            ) : null}
          </div>
        ) : (
          <span data-slot="noSchedule" className="card-empty text-sm italic text-[var(--bo-faint)]">
            Sin horario
          </span>
        )}
      </div>

      {canEdit ? (
      <div data-slot="cardActions" className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onEdit?.(date)}
          aria-label={schedule ? `Editar turno de ${memberName} el ${formattedDate}` : `Añadir turno de ${memberName} el ${formattedDate}`}
          data-role="daily-schedule-action"
          className="bo-dateBtn bo-dateBtn--glass !justify-center !gap-1.5 !px-3 !py-1.5 !h-auto text-xs"
        >
          {schedule ? <Pencil size={13} strokeWidth={1.8} aria-hidden="true" /> : <Plus size={13} strokeWidth={1.8} aria-hidden="true" />}
          {schedule ? "Editar" : "Añadir"}
        </button>
      </div>
      ) : null}
    </div>
    </>
  );
}
