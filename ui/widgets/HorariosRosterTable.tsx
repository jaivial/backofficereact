import React, { useMemo } from "react";
import { Pencil } from "lucide-react";

import type { FichajeActiveEntry, FichajeSchedule, Member } from "../../api/types";
import { Avatar, AvatarFallback, AvatarImage } from "../shell/Avatar";
import { cn } from "../shadcn/utils";

export type HorariosRosterRow = {
  member: Member;
  schedule?: FichajeSchedule;
  activeEntry?: FichajeActiveEntry;
};

export type HorariosRosterTableView = "grid" | "table";

function fullName(member: Member): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || `Miembro #${member.id}`;
}

function initials(member: Member): string {
  const first = (member.firstName || "").trim();
  const last = (member.lastName || "").trim();
  const i1 = first ? first[0] : "M";
  const i2 = last ? last[0] : String(member.id)[0] || "";
  return `${i1}${i2}`.toUpperCase();
}

function parseHHMM(value: string): number | null {
  const [h, m] = String(value || "").split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function minutesBetween(startHHMM: string, endHHMM: string): number | null {
  const start = parseHHMM(startHHMM);
  const end = parseHHMM(endHHMM);
  if (start === null || end === null) return null;
  const diff = end - start;
  if (diff <= 0) return null;
  return diff;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatDuration(minutes: number | null): string {
  if (!minutes || minutes <= 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatHM(minutes: number | null): string {
  if (minutes === null || minutes < 0) return "--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}h`;
}

function activeMinutes(activeEntry: FichajeActiveEntry | undefined, nowMs: number): number | null {
  if (!activeEntry) return null;
  const startMs = Date.parse(activeEntry.startAtIso);
  if (!Number.isFinite(startMs)) return null;
  return Math.max(0, Math.floor((nowMs - startMs) / 60000));
}

export function HorariosRosterTable({
  rows,
  nowMs,
  selectedMemberId,
  onRowClick,
  onEditMember,
  emptyLabel = "Sin miembros para mostrar.",
  ariaLabel = "Tabla de miembros",
  className,
}: {
  rows: HorariosRosterRow[];
  nowMs?: number;
  selectedMemberId?: number | null;
  onRowClick?: (member: Member) => void;
  onEditMember?: (member: Member) => void;
  emptyLabel?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const now = nowMs ?? Date.now();

  const computed = useMemo(() => {
    return rows.map((row) => {
      const scheduleMins = row.schedule ? minutesBetween(row.schedule.startTime, row.schedule.endTime) : null;
      const liveMins = activeMinutes(row.activeEntry, now);
      const progressPct = clampPercent(scheduleMins && liveMins !== null ? Math.round((liveMins / scheduleMins) * 100) : 0);
      return {
        ...row,
        memberName: fullName(row.member),
        scheduleMins,
        liveMins,
        progressPct,
      };
    });
  }, [now, rows]);

  return (
    <div className={cn("bo-tableWrap bo-horariosRosterWrap bo-horariosRosterWrap--glass", className)}>
      <div className="bo-tableScroll">
        <table className="bo-table bo-horariosRosterTable" aria-label={ariaLabel}>
          <thead>
            <tr>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--member">Empleado</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--status">Estado</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--shift">Jornada</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--hours">Horas hoy</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--percent">% Jornada</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--day">Jornada diaria</th>
              <th className="bo-horariosRosterCol bo-horariosRosterCol--actions end" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {computed.length === 0 ? (
              <tr>
                <td colSpan={7} className="bo-mutedText bo-horariosRosterEmpty">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              computed.map((row) => {
                const live = Boolean(row.activeEntry);
                const hasSchedule = Boolean(row.schedule);
                const selected = selectedMemberId ? selectedMemberId === row.member.id : false;
                const shiftLabel = row.schedule ? `${row.schedule.startTime} - ${row.schedule.endTime}` : "Sin horario";
                const shiftDuration = row.schedule ? formatDuration(row.scheduleMins) : "--";
                const todayLabel = row.liveMins !== null ? formatHM(row.liveMins) : hasSchedule ? "0:00h" : "--";

                const rowClassName = cn(
                  "bo-horariosRosterRow",
                  live && "is-live",
                  hasSchedule ? "is-assigned" : "is-unassigned",
                  selected && "is-selected",
                  onRowClick && "is-clickable",
                );

                return (
                  <tr
                    key={row.member.id}
                    className={rowClassName}
                    tabIndex={onRowClick ? 0 : -1}
                    onClick={() => onRowClick?.(row.member)}
                    onKeyDown={(e) => {
                      if (!onRowClick) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onRowClick(row.member);
                      }
                    }}
                  >
                    <td className="bo-horariosRosterCell bo-horariosRosterCell--member">
                      <div className="bo-horariosRosterMember">
                        <Avatar className="bo-avatar--sm">
                          <AvatarImage src={row.member.photoUrl ?? undefined} alt={row.memberName} />
                          <AvatarFallback>{initials(row.member)}</AvatarFallback>
                        </Avatar>
                        <div className="bo-horariosRosterMemberText">
                          <div className="bo-horariosRosterMemberName">{row.memberName}</div>
                          <div className="bo-horariosRosterMemberMeta">{hasSchedule ? shiftDuration : "Sin asignar"}</div>
                        </div>
                      </div>
                    </td>

                    <td className="bo-horariosRosterCell">
                      <div className="bo-horariosRosterStatus">
                        {live ? <span className="bo-horariosLiveDot" aria-hidden="true" /> : <span className="bo-horariosIdleDot" aria-hidden="true" />}
                        <span className="bo-horariosRosterStatusLabel">{live ? "Online" : "Offline"}</span>
                      </div>
                    </td>

                    <td className="bo-horariosRosterCell">
                      <div className={cn("bo-horariosRosterShift", !hasSchedule && "is-empty")}>{shiftLabel}</div>
                    </td>

                    <td className="bo-horariosRosterCell">
                      <div className="bo-horariosRosterMetric">
                        <div className="bo-horariosRosterMetricTop">
                          <span className="bo-horariosRosterMetricValue">{todayLabel}</span>
                          <span className="bo-horariosRosterMetricMeta">{hasSchedule ? shiftDuration : "--"}</span>
                        </div>
                        <div className="bo-meter bo-meter--sm" aria-hidden="true">
                          <div className="bo-meterFill bo-meterFill--accent" style={{ width: `${row.progressPct}%` }} />
                        </div>
                      </div>
                    </td>

                    <td className="bo-horariosRosterCell">
                      <div className="bo-horariosRosterMetric">
                        <div className="bo-horariosRosterMetricTop">
                          <span className="bo-horariosRosterMetricValue">{hasSchedule ? `${row.progressPct}%` : "--"}</span>
                          <span className="bo-horariosRosterMetricMeta">{live ? "En curso" : hasSchedule ? "Pendiente" : "—"}</span>
                        </div>
                        <div className="bo-meter bo-meter--sm" aria-hidden="true">
                          <div className="bo-meterFill bo-meterFill--accent2" style={{ width: `${row.progressPct}%` }} />
                        </div>
                      </div>
                    </td>

                    <td className="bo-horariosRosterCell">
                      <div className="bo-horariosRosterDay">
                        <span className="bo-horariosRosterDayTime">{row.schedule?.startTime ?? "--:--"}</span>
                        <div className="bo-horariosRosterDayBar" aria-hidden="true">
                          <div className="bo-horariosRosterDayBarFill" style={{ width: `${row.progressPct}%` }} />
                        </div>
                      </div>
                    </td>

                    <td className="bo-horariosRosterCell end">
                      {onEditMember ? (
                        <button
                          type="button"
                          className="bo-actionBtn bo-actionBtn--glass bo-horariosRosterEditBtn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditMember(row.member);
                          }}
                          aria-label={`Editar turno de ${row.memberName}`}
                        >
                          <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
