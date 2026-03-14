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
      className={`rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-black/[0.10] bg-card shadow-soft p-[14px] min-h-[88px] ${
        onClick ? "cursor-pointer transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] hover:border-white/[0.12]" : ""
      }`}
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
      <div className="flex items-center gap-[10px]">
        <div className="w-7 h-7 rounded-md border border-white/[0.07] bg-white/[0.02] flex items-center justify-center text-white/80" aria-hidden="true">
          <Icon k={icon} />
        </div>
        <div className="text-sm text-muted-foreground">{displayLabel}</div>
      </div>
      <div className="mt-[10px] text-[22px] font-bold tracking-tight">{value}</div>
    </div>
  );
});
