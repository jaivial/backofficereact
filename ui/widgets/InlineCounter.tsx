import React, { useCallback, useMemo } from "react";
import { Minus, Plus } from "lucide-react";

import { cn } from "../shadcn/utils";

/**
 * InlineCounter - A counter component matching the bo-field--counter pattern.
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
  /** Amount added or removed per button press (default: 1) */
  step?: number;
  /** Unique test id prefix; keeps data-testid unique when several counters share a page */
  testId?: string;
  /** Text rendered under the counter, e.g. a derived rate summary */
  helperText?: React.ReactNode;
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
  step = 1,
  testId = "inline-counter",
  helperText,
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
      onChange(Math.max(min, safeValue - step));
    }
  }, [canDecrease, disabled, min, safeValue, step, onChange]);

  const handleIncrease = useCallback(() => {
    if (canIncrease && !disabled) {
      onChange(Math.min(max, safeValue + step));
    }
  }, [canIncrease, disabled, max, safeValue, step, onChange]);

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
      className={cn("bo-field", "bo-field--counter", className)}
      data-ui="inline-counter"
      data-testid={testId}
    >
      <div className="bo-label" data-slot="inlineCounter-label">{label}</div>
      <div className="bo-counter" data-slot="inlineCounter-counter">
        <button
          type="button"
          className="bo-counterBtn"
          onClick={handleDecrease}
          disabled={disabled || !canDecrease}
          aria-label={decrementAriaLabel || `Disminuir ${label}`}
          data-action="decrease"
          data-testid={`${testId}-minus`}
        >
          <Minus size={16} strokeWidth={2} />
        </button>
        <input
          className="bo-input bo-input--sm bo-counterInput"
          type="text"
          inputMode="numeric"
          value={String(safeValue)}
          onChange={handleInputChange}
          disabled={disabled}
          aria-label={label}
          data-slot="value"
          data-testid={`${testId}-value`}
        />
        <button
          type="button"
          className="bo-counterBtn"
          onClick={handleIncrease}
          disabled={disabled || !canIncrease}
          aria-label={incrementAriaLabel || `Aumentar ${label}`}
          data-action="increase"
          data-testid={`${testId}-plus`}
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>
      {helperText ? (
        <div className="bo-mutedText" style={{ marginTop: 6, fontSize: 12 }} data-slot="inlineCounter-helper" data-testid={`${testId}-helper`}>
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
