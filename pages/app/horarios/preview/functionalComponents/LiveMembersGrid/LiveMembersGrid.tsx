import { memo, useCallback } from "react";
import type { FichajeActiveEntry, FichajeSchedule, Member } from "../../../../../../api/types";
import { MemberCard } from "../MemberCard/MemberCard";
import { Panel } from "../../../../../../ui/shell/Panel";

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
    <Panel title="Trabajando ahora" className="bo-horariosPreviewBlock" bodyClassName="bo-horariosPreviewCards" aria-label="Miembros en vivo" data-ui="liveBlock">
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
    </Panel>
  );
});
