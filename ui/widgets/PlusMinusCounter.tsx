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
    <div className={cn("flex flex-col gap-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02]", className)} aria-label={label}>
      <div className="text-xs text-muted font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <button
          className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          onClick={onDecrease}
          disabled={disabled || !canDecrease}
          aria-label={decrementAriaLabel || `Reducir ${label}`}
        >
          <Minus size={14} strokeWidth={2.2} />
        </button>

        <div className="flex-1 text-center text-sm font-semibold text-foreground">{valueText}</div>

        <button
          className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          onClick={onIncrease}
          disabled={disabled || !canIncrease}
          aria-label={incrementAriaLabel || `Aumentar ${label}`}
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </div>

      {helperText ? (
        <div className="text-xs text-muted" style={{ marginTop: 8 }}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
