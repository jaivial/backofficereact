import { cn } from "../shadcn/utils";
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
  className?: string;
};

export function HorariosRosterTable({
  rows,
  emptyLabel,
  onRowClick,
  className,
}: HorariosRosterTableProps) {
  if (rows.length === 0) {
    return <div data-ui="rosterEmpty" className="bo-horariosRosterEmpty">{emptyLabel || "Sin datos"}</div>;
  }

  return (
    <div data-ui="horariosRosterWrap" className={cn("bo-horariosRosterWrap bo-horariosRosterWrap--glass", className)}>
      <table data-ui="horariosRosterTable" className="bo-horariosRosterTable">
        <thead data-slot="tableHead">
          <tr data-role="header-row">
            <th data-col="member" className="bo-horariosRosterCol--member" data-slot="horariosRosterTable-horariosRosterCol--member">Miembro</th>
            <th data-col="shift" className="bo-horariosRosterCol--shift" data-slot="horariosRosterTable-horariosRosterCol--shift">Horario Asignado</th>
            <th data-col="status" className="bo-horariosRosterCol--status" data-slot="horariosRosterTable-horariosRosterCol--status">Estado / Fichaje</th>
          </tr>
        </thead>
        <tbody data-slot="tableBody">
          {rows.map((row) => {
            const isLive = !!row.activeEntry;
            return (
              <tr
                key={row.member.id}
                data-ui={`rosterRow-${row.member.id}`}
                className={cn("bo-horariosRosterRow", "is-clickable", isLive && "is-live", row.schedule && "is-assigned")}
                onClick={() => onRowClick(row.member)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(row.member);
                  }
                }}
              >
                <td data-col="member" className="bo-horariosRosterCol--member" data-slot="horariosRosterTable-horariosRosterCol--member">
                  <div data-ui="rosterMember" className="bo-horariosRosterMember">
                    <div data-slot="memberText" className="bo-horariosRosterMemberText">
                      <div data-slot="memberName" className="bo-horariosRosterMemberName">
                        {row.member.firstName} {row.member.lastName}
                      </div>
                    </div>
                  </div>
                </td>
                <td data-col="shift" className="bo-horariosRosterCol--shift" data-slot="horariosRosterTable-horariosRosterCol--shift">
                  <span data-slot="shiftLabel" className={cn("bo-horariosRosterShift", !row.schedule && "is-empty")}>
                    {row.schedule ? `${row.schedule.startTime} - ${row.schedule.endTime}` : "Sin asignar"}
                  </span>
                </td>
                <td data-col="status" className="bo-horariosRosterCol--status" data-slot="horariosRosterTable-horariosRosterCol--status">
                  <span data-ui="statusBadge" className="bo-horariosRosterStatus">
                    {isLive ? (
                      <>
                        <span data-slot="liveDot" className="bo-horariosLiveDot" />
                        <span data-slot="statusLabel" className="bo-horariosRosterStatusLabel">Trabajando</span>
                      </>
                    ) : (
                      <>
                        <span data-slot="idleDot" className="bo-horariosIdleDot" />
                        <span data-slot="statusLabel" className="bo-horariosRosterStatusLabel">Inactivo</span>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
