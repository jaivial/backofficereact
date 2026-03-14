import React, { useCallback, useMemo } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../shadcn/utils";

/**
 * InlineCounter - An inline counter component for adjusting values.
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles increment/decrement counter logic
 * - Open/Closed: Extensible via props without modifying component
 * - Liskov Substitution: Can replace any counter with same interface
 * - Interface Segregation: Minimal required props, optional extras
 * - Dependency Inversion: Uses callback props, not coupled to state management
 */
type InlineCounterProps = {
  /** Label displayed above the counter */
  label: string;
  /** Current value of the counter */
  value: number;
  /** Callback when value changes */
  onChange: (nextValue: number) => void;
  /** Minimum allowed value (default: 0) */
  min?: number;
  /** Maximum allowed value (default: 10000) */
  max?: number;
  /** Whether the counter is disabled */
  disabled?: boolean;
  /** Optional CSS class name for the field container */
  className?: string;
  /** Decrement button aria label */
  decrementAriaLabel?: string;
  /** Increment button aria label */
  incrementAriaLabel?: string;
};

export function InlineCounter({
  label,
  value,
  onChange,
  min = 0,
  max = 10000,
  disabled = false,
  className,
  decrementAriaLabel,
  incrementAriaLabel,
}: InlineCounterProps) {
  // Clamp value to valid range
  const safeValue = useMemo(() => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, Math.trunc(num)));
  }, [value, min, max]);

  // Check if buttons should be disabled
  const canDecrease = useMemo(() => safeValue > min, [safeValue, min]);
  const canIncrease = useMemo(() => safeValue < max, [safeValue, max]);

  // Stable handlers
  const handleDecrease = useCallback(() => {
    if (canDecrease && !disabled) {
      onChange(Math.max(min, safeValue - 1));
    }
  }, [canDecrease, disabled, min, safeValue, onChange]);

  const handleIncrease = useCallback(() => {
    if (canIncrease && !disabled) {
      onChange(Math.min(max, safeValue + 1));
    }
  }, [canIncrease, disabled, max, safeValue, onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9-]/g, "");
      const num = Number(raw);
      if (Number.isFinite(num)) {
        onChange(Math.max(min, Math.min(max, Math.trunc(num))));
      }
    },
    [min, max, onChange]
  );

  return (
    <div
      className={cn("grid gap-1.5", className)}
      data-ui="inline-counter"
    >
      <div className="text-xs text-muted font-semibold">{label}</div>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleDecrease}
          disabled={disabled || !canDecrease}
          aria-label={decrementAriaLabel || `Disminuir ${label}`}
          data-action="decrease"
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <input
          className="h-8.5 w-16 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 text-center text-sm text-foreground outline-none transition-colors duration-150 focus:border-primary/40 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)] disabled:opacity-50 disabled:cursor-not-allowed"
          type="text"
          inputMode="numeric"
          value={String(safeValue)}
          onChange={handleInputChange}
          disabled={disabled}
          aria-label={label}
          data-slot="value"
        />
        <button
          type="button"
          className="h-8 w-8 rounded-lg border border-white/[0.06] bg-white/[0.03] flex items-center justify-center text-foreground/80 hover:bg-white/[0.06] hover:border-white/[0.12] transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleIncrease}
          disabled={disabled || !canIncrease}
          aria-label={incrementAriaLabel || `Aumentar ${label}`}
          data-action="increase"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
