import React, { memo } from "react";
import { CalendarDays, CheckCircle2, Clock3, Users, FileText, TrendingUp } from "lucide-react";

type IconKey = "calendar" | "check" | "clock" | "users" | "file-text" | "trending-up";

function Icon({ k }: { k: IconKey }) {
  const props = { size: 18, strokeWidth: 1.8 } as const;
  if (k === "check") return <CheckCircle2 {...props} />;
  if (k === "clock") return <Clock3 {...props} />;
  if (k === "users") return <Users {...props} />;
  if (k === "file-text") return <FileText {...props} />;
  if (k === "trending-up") return <TrendingUp {...props} />;
  return <CalendarDays {...props} />;
}

export const StatCard = memo(function StatCard({
  label,
  title,
  value,
  icon,
  onClick,
}: {
  label?: string;
  title?: string;
  value: string;
  icon: IconKey;
  onClick?: () => void;
}) {
  const displayLabel = label ?? title ?? "";
  return (
    <div
      className={`bo-card bo-card--glass ${onClick ? "bo-card--clickable" : ""}`}
      aria-label={displayLabel}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      <div className="bo-statTop">
        <div className="bo-statIcon" aria-hidden="true">
          <Icon k={icon} />
        </div>
        <div className="bo-statLabel">{displayLabel}</div>
      </div>
      <div className="bo-statValue">{value}</div>
    </div>
  );
});
