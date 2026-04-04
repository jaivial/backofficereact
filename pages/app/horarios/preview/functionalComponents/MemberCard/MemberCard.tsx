import { memo, useCallback } from "react";
import type { FichajeSchedule, Member } from "../../../../../../api/types";
import type { FichajeActiveEntry } from "../../../../../../api/types";
import { elapsedLabel, fullName, scheduleLabel } from "../../utils";

type MemberCardProps = {
  member: Member;
  variant: "live" | "idle";
  entry?: FichajeActiveEntry;
  schedule?: FichajeSchedule;
  tick?: number;
  onClick: (member: Member) => void;
};

export const MemberCard = memo(function MemberCard({
  member,
  variant,
  entry,
  schedule,
  tick,
  onClick,
}: MemberCardProps) {
  const handleClick = useCallback(() => onClick(member), [member, onClick]);
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick(member);
      }
    },
    [member, onClick],
  );

  const isLive = variant === "live";
  const prefix = isLive ? "live" : "idle";

  return (
    <article
      data-ui={`${prefix}Member-${member.id}`}
      className={`bo-memberCard${isLive ? " bo-memberCard--live" : ""}${schedule ? " bo-memberCard--assigned" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div data-slot="memberName" className="bo-memberName">{fullName(member)}</div>
      {isLive ? (
        <div data-slot="memberSub" className="bo-memberSub">
          {entry && tick ? elapsedLabel(entry.startAtIso, tick) : "--:--:--"}
        </div>
      ) : null}
      <div data-ui="memberBadges" className="bo-horariosPreviewBadges">
        {isLive ? (
          <span data-ui="liveBadge" className="bo-badge bo-horariosPreviewBadge bo-horariosPreviewBadge--live">En vivo</span>
        ) : null}
        <span
          data-ui="assignBadge"
          className={`bo-badge bo-horariosPreviewBadge${schedule ? " is-assigned" : " is-unassigned"}`}
        >
          {schedule ? "Asignado hoy" : "Sin asignar"}
        </span>
      </div>
      <div data-slot="memberMeta" className="bo-memberMeta">{scheduleLabel(schedule)}</div>
    </article>
  );
});
