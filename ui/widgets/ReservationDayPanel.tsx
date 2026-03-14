import React from "react";
import { Lock, LockOpen } from "lucide-react";

import type { ConfigDayStatus } from "../../api/types";

type ReservationDayStateBlockProps = {
  day: ConfigDayStatus;
  busy?: boolean;
  onToggleDay?: () => void;
  actionLabel?: string;
  actionMode?: "toggle" | "openOnly";
  description?: string | null;
  label?: string;
  hideAction?: boolean;
  className?: string;
};

type ReservationDayPanelProps = ReservationDayStateBlockProps & {
  title: React.ReactNode;
  meta?: React.ReactNode;
  rightSlot?: React.ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
};

type ReservationDayClosedPanelProps = ReservationDayStateBlockProps & {
  title?: React.ReactNode;
  meta?: React.ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
};

export function reservationDayFadeTransition(reduceMotion: boolean) {
  return reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };
}

export function ReservationDayStateBlock({
  day,
  busy = false,
  onToggleDay,
  actionLabel,
  actionMode = "toggle",
  description,
  label = "Estado del día",
  hideAction = false,
  className,
}: ReservationDayStateBlockProps) {
  const buttonLabel = actionLabel ?? (actionMode === "openOnly" ? "Abrir día" : day.isOpen ? "Cerrar día" : "Abrir día");

  return (
    <div className={["flex flex-col gap-3", className].filter(Boolean).join(" ")}>
      <div className="text-xs text-muted font-semibold">{label}</div>
      <div className="flex items-center gap-2 text-sm text-foreground">
        {day.isOpen ? <LockOpen size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
        <span>{day.isOpen ? "Abierto" : "Cerrado"}</span>
      </div>
      {description ? <div className="text-xs text-muted">{description}</div> : null}
      {!hideAction && onToggleDay ? (
        <button className="h-10 px-4 rounded-lg border border-primary/30 bg-primary/16 text-foreground font-bold inline-flex items-center justify-center transition-all duration-150 hover:bg-primary/24 hover:border-primary/40 disabled:opacity-55 disabled:cursor-not-allowed" type="button" onClick={onToggleDay} disabled={busy}>
          {buttonLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ReservationDayPanel({
  title,
  meta,
  day,
  busy = false,
  onToggleDay,
  actionLabel,
  actionMode = "toggle",
  description,
  label,
  hideAction = false,
  rightSlot,
  panelClassName,
  bodyClassName,
}: ReservationDayPanelProps) {
  return (
    <div className={["rounded-lg border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-black/[0.13] bg-card", panelClassName].filter(Boolean).join(" ")}>
      <div className="flex items-end justify-between p-4 pb-2">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {meta ? <div className="text-xs text-muted">{meta}</div> : null}
      </div>
      <div className={["p-4 pt-2", "flex items-center justify-between gap-4", bodyClassName].filter(Boolean).join(" ")}>
        <ReservationDayStateBlock
          day={day}
          busy={busy}
          onToggleDay={onToggleDay}
          actionLabel={actionLabel}
          actionMode={actionMode}
          description={description}
          label={label}
          hideAction={hideAction}
        />
        {rightSlot}
      </div>
    </div>
  );
}
