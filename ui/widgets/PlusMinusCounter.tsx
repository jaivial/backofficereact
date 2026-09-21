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
  /**
   * Visual shell.
   *  - "timeAdjust" (default): the existing `bo-timeAdjustCounter` look. Its
   *    controls row is a 3-column grid whose value column is `1fr`, so the
   *    counter stretches to fill its parent.
   *  - "counter": the `bo-counter` look used by InlineCounter — an
   *    inline-flex row that hugs its content, so it centres cleanly.
   * Opt-in, because this component is rendered on ~9 screens that rely on
   * the current stretch behaviour.
   */
  variant?: "timeAdjust" | "counter";
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
  variant = "timeAdjust",
}: PlusMinusCounterProps) {
  const valueText = String(value);
  const isCounter = variant === "counter";

  return (
    <div
      className={cn(
        isCounter ? "bo-field bo-field--counter" : "bo-timeAdjustCounter bo-timeAdjustCounter--glass",
        className,
      )}
      aria-label={label}
      data-slot="plus-minus-counter"
      data-variant={variant}
    >
      <div
        className={isCounter ? "bo-label" : "bo-timeAdjustCounterLabel"}
        data-slot="plus-minus-counter-label"
      >
        {label}
      </div>
      <div
        className={isCounter ? "bo-counter" : "bo-timeAdjustCounterCtrls"}
        data-slot="plus-minus-counter-controls"
      >
        <button
          className={cn("bo-counterBtn", !isCounter && "bo-counterBtn--glass")}
          type="button"
          onClick={onDecrease}
          disabled={disabled || !canDecrease}
          aria-label={decrementAriaLabel || `Reducir ${label}`}
          data-testid="plus-minus-counter-minus"
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>

        <div
          className={cn(
            isCounter
              ? "bo-input bo-input--sm bo-counterInput grid place-items-center"
              : "bo-timeAdjustCounterValue bo-timeAdjustCounterValue--glass",
          )}
          data-slot="plus-minus-counter-value"
        >
          {valueText}
        </div>

        <button
          className={cn("bo-counterBtn", !isCounter && "bo-counterBtn--glass")}
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
