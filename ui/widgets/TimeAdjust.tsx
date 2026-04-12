import React from "react";

import { cn } from "../shadcn/utils";

export function TimeAdjust({
  label,
  value,
  onMinus,
  onPlus,
  disabled,
  className,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("bo-timeAdjust bo-timeAdjust--glass", className)} aria-label={label} data-slot="time-adjust">
      <div className="bo-timeAdjustLabel" data-slot="time-adjust-label">{label}</div>
      <div className="bo-timeAdjustCtrls" data-slot="time-adjust-controls">
        <button className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass" type="button" onClick={onMinus} disabled={disabled} aria-label={`${label} menos 15 minutos`} data-testid="time-adjust-minus">
          -15
        </button>
        <div className="bo-timeAdjustValue bo-timeAdjustValue--glass" data-slot="time-adjust-value">{value}</div>
        <button className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass" type="button" onClick={onPlus} disabled={disabled} aria-label={`${label} mas 15 minutos`} data-testid="time-adjust-plus">
          +15
        </button>
      </div>
    </div>
  );
}
