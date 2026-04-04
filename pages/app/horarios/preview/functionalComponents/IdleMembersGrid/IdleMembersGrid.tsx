import { memo } from "react";
import type { FichajeSchedule, Member } from "../../../../../../api/types";
import { MemberCard } from "../MemberCard/MemberCard";

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
    <section aria-label="Miembros fuera de turno" data-ui="idleBlock" className="bo-horariosPreviewBlock">
      <div data-slot="blockTitle" className="bo-panelTitle">No trabajando ahora</div>
      <div data-ui="idleCards" className="bo-horariosPreviewCards">
        {members.map((member) => (
          <MemberCard
            key={`idle-${member.id}`}
            member={member}
            variant="idle"
            schedule={schedulesByMember.get(member.id)}
            onClick={onMemberClick}
          />
        ))}
      </div>
    </section>
  );
});
