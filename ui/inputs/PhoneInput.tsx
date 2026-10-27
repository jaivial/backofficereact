import React from "react";
import { cn } from "../shadcn/utils";

import { phoneCodeOptions } from "../lib/phone";
import { Select } from "./Select";

export function PhoneInput({
  countryCode,
  number,
  onCountryCodeChange,
  onNumberChange,
  onBlur,
  disabled,
  invalid,
  describedBy,
  countryAriaLabel = "Prefijo",
  numberAriaLabel = "Telefono",
  className,
  testId,
}: {
  countryCode: string;
  number: string;
  onCountryCodeChange: (next: string) => void;
  onNumberChange: (next: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Marks the number as invalid (error style + aria-invalid). */
  invalid?: boolean;
  /** id of the element describing the error. */
  describedBy?: string;
  countryAriaLabel?: string;
  numberAriaLabel?: string;
  className?: string;
  /** Unique data-testid of the number input; the prefix select gets `${testId}-cc`. */
  testId?: string;
}) {
  // A stored prefix outside the shared list (e.g. a booking from +41) stays
  // selectable instead of silently showing the first option.
  const cc = countryCode || "34";
  const options = phoneCodeOptions.some((o) => o.value === cc) ? phoneCodeOptions : [{ value: cc, label: `+${cc}`, icon: null }, ...phoneCodeOptions];
  return (
    <div className={cn("bo-phone", className)} data-ui="phone-input" data-testid={testId ? `${testId}-group` : undefined}>
      <Select
        className="bo-phoneCC"
        value={cc}
        onChange={onCountryCodeChange}
        ariaLabel={countryAriaLabel}
        options={options}
        disabled={disabled}
        data-testid={testId ? `${testId}-cc` : undefined}
      />
      <input
        className={cn("bo-input bo-phoneNum", invalid && "bo-input--error")}
        inputMode="tel"
        value={number}
        onChange={(e) => onNumberChange(e.target.value)}
        onBlur={onBlur}
        aria-label={numberAriaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        disabled={disabled}
        data-testid={testId ?? "phone-input"}
      />
    </div>
  );
}
