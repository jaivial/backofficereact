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
    <div className={["bo-configDayState", className].filter(Boolean).join(" ")}>
      <div className="bo-label">{label}</div>
      <div className="bo-configStatus">
        {day.isOpen ? <LockOpen size={16} strokeWidth={1.8} /> : <Lock size={16} strokeWidth={1.8} />}
        <span>{day.isOpen ? "Abierto" : "Cerrado"}</span>
      </div>
      {description ? <div className="bo-mutedText">{description}</div> : null}
      {!hideAction && onToggleDay ? (
        <button className="bo-btn bo-btn--primary bo-btn--fit" type="button" onClick={onToggleDay} disabled={busy}>
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
    <div className={["bo-panel", "bo-dayStatePanel", panelClassName].filter(Boolean).join(" ")}>
      <div className="bo-panelHead">
        <div className="bo-panelTitle">{title}</div>
        {meta ? <div className="bo-panelMeta">{meta}</div> : null}
      </div>
      <div className={["bo-panelBody", "bo-configDayLimitRow", bodyClassName].filter(Boolean).join(" ")}>
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
