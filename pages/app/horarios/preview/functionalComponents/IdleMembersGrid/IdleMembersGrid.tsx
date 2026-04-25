import { memo } from "react";
import type { FichajeSchedule, Member } from "../../../../../../api/types";
import { MemberCard } from "../MemberCard/MemberCard";
import { Panel } from "../../../../../../ui/shell/Panel";

type IdleMembersGridProps = {
  members: Member[];
  schedulesByMember: Map<number, FichajeSchedule>;
  onMemberClick: (member: Member) => void;
};

export const IdleMembersGrid = memo(function IdleMembersGrid({
  members,
  schedulesByMember,
  onMemberClick,
}: IdleMembersGridProps) {
  return (
    <Panel title="No trabajando ahora" className="bo-horariosPreviewBlock" bodyClassName="bo-horariosPreviewCards" aria-label="Miembros fuera de turno" data-ui="idleBlock">
      {members.map((member) => (
        <MemberCard
          key={`idle-${member.id}`}
          member={member}
          variant="idle"
          schedule={schedulesByMember.get(member.id)}
          onClick={onMemberClick}
        />
      ))}
    </Panel>
  );
});
