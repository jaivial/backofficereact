import React from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../shadcn/utils";

type PlusMinusCounterProps = {
  label: string;
  value: string | number;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease?: boolean;
  canIncrease?: boolean;
  disabled?: boolean;
  helperText?: string;
  decrementAriaLabel?: string;
  incrementAriaLabel?: string;
  className?: string;
};

export function PlusMinusCounter({
  label,
  value,
  onDecrease,
  onIncrease,
  canDecrease = true,
  canIncrease = true,
  disabled,
  helperText,
  decrementAriaLabel,
  incrementAriaLabel,
  className,
}: PlusMinusCounterProps) {
  const valueText = String(value);

  return (
    <div className={cn("bo-timeAdjustCounter bo-timeAdjustCounter--glass", className)} aria-label={label} data-slot="plus-minus-counter">
      <div className="bo-timeAdjustCounterLabel" data-slot="plus-minus-counter-label">{label}</div>
      <div className="bo-timeAdjustCounterCtrls" data-slot="plus-minus-counter-controls">
        <button
          className="bo-counterBtn bo-counterBtn--glass"
          type="button"
          onClick={onDecrease}
          disabled={disabled || !canDecrease}
          aria-label={decrementAriaLabel || `Reducir ${label}`}
          data-testid="plus-minus-counter-minus"
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>

        <div className="bo-timeAdjustCounterValue bo-timeAdjustCounterValue--glass" data-slot="plus-minus-counter-value">{valueText}</div>

        <button
          className="bo-counterBtn bo-counterBtn--glass"
          type="button"
          onClick={onIncrease}
          disabled={disabled || !canIncrease}
          aria-label={incrementAriaLabel || `Aumentar ${label}`}
          data-testid="plus-minus-counter-plus"
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </div>

      {helperText ? (
        <div className="bo-mutedText" style={{ marginTop: 8, fontSize: 12 }} data-slot="plus-minus-counter-helper">
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
