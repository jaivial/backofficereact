import React, { memo } from "react";
import { CalendarDays, CheckCircle2, Clock3, Users } from "lucide-react";

type IconKey = "calendar" | "check" | "clock" | "users";

function Icon({ k }: { k: IconKey }) {
  const props = { size: 18, strokeWidth: 1.8 } as const;
  if (k === "check") return <CheckCircle2 {...props} />;
  if (k === "clock") return <Clock3 {...props} />;
  if (k === "users") return <Users {...props} />;
  return <CalendarDays {...props} />;
}

export const StatCard = memo(function StatCard({ label, value, icon }: { label: string; value: string; icon: IconKey }) {
  return (
    <div className="bo-card" aria-label={label}>
      <div className="bo-statTop">
        <div className="bo-statIcon" aria-hidden="true">
          <Icon k={icon} />
        </div>
        <div className="bo-statLabel">{label}</div>
      </div>
      <div className="bo-statValue">{value}</div>
    </div>
  );
});

