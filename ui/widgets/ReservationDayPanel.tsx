import React from "react";
import { Lock, LockOpen } from "lucide-react";
import { cn } from "../shadcn/utils";

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
    <div className={cn("bo-configDayState flex flex-col !justify-center !items-center !gap-4 pt-4", className)} data-slot="reservation-day-state-block">
      <div className="bo-label !text-center" data-slot="reservation-day-state-label">{label}</div>
      <div className="bo-configStatus !text-center flex flex-row justify-center" data-slot="reservation-day-status">
        {day.isOpen ? <LockOpen size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
        <span data-slot="reservation-day-status-text">{day.isOpen ? "Abierto" : "Cerrado"}</span>
      </div>
      {description ? <div className="bo-mutedText" data-slot="reservation-day-description">{description}</div> : null}
      {!hideAction && onToggleDay ? (
        <button className="bo-btn bo-btn--primary bo-btn--fit" type="button" onClick={onToggleDay} disabled={busy} data-testid="reservation-day-toggle-btn">
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
    <div className={cn("bo-panel", "bo-dayStatePanel", "!w-fit py-4 px-14 !mx-auto", panelClassName)} data-slot="reservation-day-panel">
      <div className={cn("bo-panelBody", "bo-configDayLimitRow", "!flex !flex-col gap-2 !justify-center !items-center", bodyClassName)} data-slot="reservation-day-panel-body">
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

export function ReservationDayClosedPanel({
  title = "Día cerrado",
  meta,
  panelClassName,
  bodyClassName,
  ...props
}: ReservationDayClosedPanelProps) {
  return <ReservationDayPanel title={title} meta={meta} panelClassName={panelClassName} bodyClassName={bodyClassName} {...props} />;
}
