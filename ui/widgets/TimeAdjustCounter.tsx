import React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../shadcn/utils";

export const TimeAdjustCounter = React.memo(function TimeAdjustCounter({
  label,
  value,
  onMinus,
  onPlus,
  disabled,
  className,
  valueControl,
  onValueClick,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  disabled?: boolean;
  className?: string;
  valueControl?: React.ReactNode;
  onValueClick?: () => void;
}) {
  return (
    <div className={cn("bo-timeAdjustCounter bo-timeAdjustCounter--glass", className)} aria-label={label} data-slot="time-adjust-counter">
      <div className="bo-timeAdjustCounterLabel" data-slot="time-adjust-counter-label">{label}</div>
      <div className="bo-timeAdjustCounterCtrls" data-slot="time-adjust-counter-controls">
        <button
          className="bo-counterBtn bo-counterBtn--glass"
          type="button"
          onClick={onMinus}
          disabled={disabled}
          aria-label={`${label} menos 15 minutos`}
          data-testid="time-adjust-counter-minus"
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>
        {valueControl ?? (
          <button
            className="bo-timeAdjustCounterValue bo-timeAdjustCounterValue--glass bo-timeAdjustCounterValueButton"
            type="button"
            onClick={onValueClick}
            disabled={disabled || !onValueClick}
            data-slot="time-adjust-counter-value"
            aria-label={`Editar ${label}`}
          >
            {value}
          </button>
        )}
        <button
          className="bo-counterBtn bo-counterBtn--glass"
          type="button"
          onClick={onPlus}
          disabled={disabled}
          aria-label={`${label} más 15 minutos`}
          data-testid="time-adjust-counter-plus"
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
});
