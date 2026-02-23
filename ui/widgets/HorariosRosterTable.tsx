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
    return <div className="bo-mutedText p-4 text-center">{emptyLabel || "Sin datos"}</div>;
  }

  return (
    <div className="bo-tableWrapper">
      <table className="bo-table w-full text-left border-collapse">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="p-3 font-medium text-gray-500">Miembro</th>
            <th className="p-3 font-medium text-gray-500">Horario Asignado</th>
            <th className="p-3 font-medium text-gray-500">Estado / Fichaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr
              key={row.member.id}
              onClick={() => onRowClick(row.member)}
              className="cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <td className="p-3">
                {row.member.firstName} {row.member.lastName}
              </td>
              <td className="p-3">
                {row.schedule ? `${row.schedule.startTime} - ${row.schedule.endTime}` : "Sin asignar"}
              </td>
              <td className="p-3">
                {row.activeEntry ? (
                  <span className="text-green-600 font-medium">Trabajando</span>
                ) : (
                  <span className="text-gray-400">Inactivo</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
