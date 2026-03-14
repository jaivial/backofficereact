import React from "react";
import type { FichajeSchedule, Member } from "../../api/types";

export type HorariosRosterTableView = "grid" | "table";

export type HorariosRosterRow = {
  member: Member;
  schedule?: FichajeSchedule;
  activeEntry?: any;
};

export type HorariosRosterTableProps = {
  rows: HorariosRosterRow[];
  nowMs?: number;
  selectedMemberId: number | null;
  onRowClick: (member: Member) => void;
  onEditMember: (member: Member) => void;
  ariaLabel?: string;
  emptyLabel?: string;
};

export function HorariosRosterTable({
  rows,
  emptyLabel,
  onRowClick,
}: HorariosRosterTableProps) {
  if (rows.length === 0) {
    return <div className="text-xs text-muted p-4 text-center">{emptyLabel || "Sin datos"}</div>;
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <table className="w-full text-left border-collapse">
        <thead className="border-b border-white/[0.06]">
          <tr>
            <th className="p-3 text-xs font-medium text-muted">Miembro</th>
            <th className="p-3 text-xs font-medium text-muted">Horario Asignado</th>
            <th className="p-3 text-xs font-medium text-muted">Estado / Fichaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {rows.map((row) => (
            <tr
              key={row.member.id}
              onClick={() => onRowClick(row.member)}
              className="cursor-pointer transition-colors duration-150 hover:bg-white/[0.02]"
            >
              <td className="p-3 text-sm text-foreground">
                {row.member.firstName} {row.member.lastName}
              </td>
              <td className="p-3 text-sm text-foreground">
                {row.schedule ? `${row.schedule.startTime} - ${row.schedule.endTime}` : "Sin asignar"}
              </td>
              <td className="p-3">
                {row.activeEntry ? (
                  <span className="text-xs font-medium text-success">Trabajando</span>
                ) : (
                  <span className="text-xs text-muted">Inactivo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
