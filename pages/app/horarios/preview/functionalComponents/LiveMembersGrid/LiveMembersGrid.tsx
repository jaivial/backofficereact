import { memo, useCallback } from "react";
import type { FichajeActiveEntry, FichajeSchedule, Member } from "../../../../../../api/types";
import { MemberCard } from "../MemberCard/MemberCard";

type LiveMembersGridProps = {
  members: Member[];
  activeEntriesForDate: Map<number, FichajeActiveEntry>;
  schedulesByMember: Map<number, FichajeSchedule>;
  tick: number;
  onMemberClick: (member: Member) => void;
};

export const LiveMembersGrid = memo(function LiveMembersGrid({
  members,
  activeEntriesForDate,
  schedulesByMember,
  tick,
  onMemberClick,
}: LiveMembersGridProps) {
  return (
    <section aria-label="Miembros en vivo" data-ui="liveBlock" className="bo-horariosPreviewBlock">
      <div data-slot="blockTitle" className="bo-panelTitle">Trabajando ahora</div>
      <div data-ui="liveCards" className="bo-horariosPreviewCards">
        {members.map((member) => (
          <MemberCard
            key={`live-${member.id}`}
            member={member}
            variant="live"
            entry={activeEntriesForDate.get(member.id)}
            schedule={schedulesByMember.get(member.id)}
            tick={tick}
            onClick={onMemberClick}
          />
        ))}
        {members.length === 0 ? (
          <div data-ui="emptyLive" className="bo-mutedText">No hay fichajes abiertos para esta fecha.</div>
        ) : null}
      </div>
    </section>
  );
});
